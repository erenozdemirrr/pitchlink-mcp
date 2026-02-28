import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolContext } from '../server.js'

export interface PitchSection {
  name: string
  found: boolean
  content: string
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

export interface PitchAnalysisResult {
  title: string
  sections: PitchSection[]
  overallNarrative: string
  investorReadiness: 'not_ready' | 'early' | 'promising' | 'strong' | 'fundable'
}

const SECTION_KEYWORDS: Record<string, string[]> = {
  problem: ['problem', 'sorun', 'ağrı', 'pain', 'challenge', 'pain point'],
  solution: ['solution', 'çözüm', 'ürün', 'product', 'platform', 'hizmet', 'service'],
  market: ['market', 'pazar', 'TAM', 'SAM', 'SOM', 'büyüklük', 'size', 'opportunity'],
  team: ['team', 'ekip', 'kurucu', 'founder', 'CEO', 'CTO', 'deneyim', 'experience'],
  financial: ['finansal', 'financial', 'gelir', 'revenue', 'maliyet', 'cost', 'projeksiyon', 'ARR', 'MRR'],
}

function detectSection(content: string, keywords: string[]): { found: boolean; excerpt: string } {
  const lower = content.toLowerCase()
  const found = keywords.some(k => lower.includes(k.toLowerCase()))
  if (!found) return { found: false, excerpt: '' }
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase())
    if (idx !== -1) {
      return { found: true, excerpt: content.slice(Math.max(0, idx - 50), idx + 300) }
    }
  }
  return { found: true, excerpt: '' }
}

function analyzeProblem(excerpt: string, found: boolean): PitchSection {
  return {
    name: 'Problem', found, content: excerpt,
    score: found ? (excerpt.length > 100 ? 75 : 50) : 10,
    strengths: found ? ['Problem varlığı ifade edilmiş'] : [],
    weaknesses: [...(!found ? ['Problem bölümü bulunamadı'] : []), ...(excerpt.length < 150 ? ['Yeterince detaylandırılmamış'] : [])],
    suggestions: ['Problemin kimin için yaşandığını rakamla belirtin', '"Bu problem yıllık ₺X\'e mal oluyor" ekleyin', 'Hedef kullanıcıdan alıntı kullanın'],
  }
}

function analyzeSolution(excerpt: string, found: boolean): PitchSection {
  return {
    name: 'Çözüm', found, content: excerpt,
    score: found ? (excerpt.length > 100 ? 70 : 45) : 10,
    strengths: found ? ['Çözüm yaklaşımı belirtilmiş'] : [],
    weaknesses: [...(!found ? ['Çözüm bölümü bulunamadı'] : []), ...(excerpt.length < 150 ? ['Nasıl çalıştığı yeterince açıklanmamış'] : [])],
    suggestions: ['Kullanıcı akışını adım adım yazın', 'Rakiplerden farklılaştıran 3 özelliği listeleyin', 'Demo bağlantısı ekleyin'],
  }
}

function analyzeMarket(excerpt: string, found: boolean): PitchSection {
  const hasTAM = /TAM|SAM|SOM/i.test(excerpt)
  const hasNumbers = /\$|₺|\d+\s*(M|B|milyar|milyon|billion|million)/i.test(excerpt)
  return {
    name: 'Pazar Büyüklüğü', found, content: excerpt,
    score: found ? (hasTAM && hasNumbers ? 85 : hasTAM || hasNumbers ? 60 : 40) : 5,
    strengths: [...(hasTAM ? ['TAM/SAM/SOM çerçevesi var'] : []), ...(hasNumbers ? ['Sayısal veri mevcut'] : [])],
    weaknesses: [...(!found ? ['Pazar analizi yok'] : []), ...(!hasTAM ? ['TAM/SAM/SOM ayrımı yapılmamış'] : []), ...(!hasNumbers ? ['Pazar rakamları verilmemiş'] : [])],
    suggestions: ['TAM→SAM→SOM hunisini kaynakla destekleyin', 'Bottom-up hesaplama ekleyin', 'Pazar büyüme oranını (CAGR) belirtin'],
  }
}

function analyzeTeam(excerpt: string, found: boolean): PitchSection {
  const hasRoles = /CEO|CTO|COO|founder|kurucu/i.test(excerpt)
  const hasExp = /yıl|year|üniversite|exit|startup/i.test(excerpt)
  return {
    name: 'Ekip', found, content: excerpt,
    score: found ? (hasRoles && hasExp ? 80 : hasRoles || hasExp ? 55 : 35) : 5,
    strengths: [...(hasRoles ? ['Roller belirtilmiş'] : []), ...(hasExp ? ['Deneyime değinilmiş'] : [])],
    weaknesses: [...(!found ? ['Ekip bölümü yok'] : []), ...(!hasRoles ? ['Görev dağılımı yok'] : []), ...(!hasExp ? ['"Neden bu ekip?" sorusu yanıtsız'] : [])],
    suggestions: ['Her kurucunun neden doğru kişi olduğunu 1 cümleyle yazın', 'Domain expertise\'i öne çıkarın', 'Teknik + iş + sektör becerilerini dengeleyin'],
  }
}

function analyzeFinancial(excerpt: string, found: boolean): PitchSection {
  const hasProjection = /projeksiyon|ARR|MRR|revenue|gelir|\d{4}/i.test(excerpt)
  const hasBurn = /burn|runway|maliyet|cost/i.test(excerpt)
  return {
    name: 'Finansal Projeksiyon', found, content: excerpt,
    score: found ? (hasProjection && hasBurn ? 80 : hasProjection || hasBurn ? 55 : 35) : 5,
    strengths: [...(hasProjection ? ['Gelir projeksiyonu mevcut'] : []), ...(hasBurn ? ['Maliyet yapısına değinilmiş'] : [])],
    weaknesses: [...(!found ? ['Finansal bölüm yok'] : []), ...(!hasProjection ? ['3 yıllık projeksiyon yok'] : []), ...(!hasBurn ? ['Burn rate / runway belirtilmemiş'] : [])],
    suggestions: ['3 yıllık P&L ekleyin (optimist/baz/kötümser)', 'Unit economics: CAC, LTV, LTV/CAC', 'Bu tur ile kaç ay runway? Açıkça belirtin'],
  }
}

export function register(server: McpServer, _ctx: ToolContext) {
  server.tool(
    'analyze_pitch_sections',
    [
      'Girişim taslağının bölümlerini (Problem, Çözüm, Pazar, Ekip, Finansal) analiz eder.',
      'Le Chat, Notion connector\'ı ile sayfayı okuduktan sonra içeriği bu tool\'a geçirir.',
      'content: Notion sayfasından okunan düz metin içeriği.',
      'title: Taslağın başlığı.',
    ].join(' '),
    {
      content: z.string().describe('Notion sayfasından okunan taslak metni (Le Chat\'in Notion connector\'ından gelir)'),
      title: z.string().describe('Girişim / taslak başlığı'),
    },
    { readOnlyHint: true },
    async ({ content, title }) => {
      const sections: PitchSection[] = []

      for (const [key, keywords] of Object.entries(SECTION_KEYWORDS)) {
        const { found, excerpt } = detectSection(content, keywords)
        switch (key) {
          case 'problem':   sections.push(analyzeProblem(excerpt, found)); break
          case 'solution':  sections.push(analyzeSolution(excerpt, found)); break
          case 'market':    sections.push(analyzeMarket(excerpt, found)); break
          case 'team':      sections.push(analyzeTeam(excerpt, found)); break
          case 'financial': sections.push(analyzeFinancial(excerpt, found)); break
        }
      }

      const avg = Math.round(sections.reduce((s, sec) => s + sec.score, 0) / sections.length)
      const readiness: PitchAnalysisResult['investorReadiness'] =
        avg >= 80 ? 'fundable' : avg >= 65 ? 'strong' : avg >= 50 ? 'promising' : avg >= 30 ? 'early' : 'not_ready'

      const narrative = [
        `"${title}" taslağı ${avg}/100 genel skor aldı.`,
        sections.filter(s => s.score >= 65).length > 0
          ? `Güçlü: ${sections.filter(s => s.score >= 65).map(s => s.name).join(', ')}.`
          : 'Tüm bölümler geliştirme gerektiriyor.',
        sections.filter(s => s.score < 40).length > 0
          ? `Kritik eksik: ${sections.filter(s => s.score < 40).map(s => s.name).join(', ')}.`
          : '',
      ].filter(Boolean).join(' ')

      const result: PitchAnalysisResult = { title, sections, overallNarrative: narrative, investorReadiness: readiness }

      return {
        structuredContent: result,
        content: [{
          type: 'text' as const,
          text: [
            `## 🔍 Bölüm Analizi: "${title}"`,
            `**Genel Skor:** ${avg}/100 — ${readiness.replace('_', ' ').toUpperCase()}`,
            '',
            ...sections.map(s => [
              `### ${s.found ? '✅' : '❌'} ${s.name} — ${s.score}/100`,
              s.strengths.length ? `**Güçlü:** ${s.strengths.join('; ')}` : '',
              s.weaknesses.length ? `**Zayıf:** ${s.weaknesses.join('; ')}` : '',
            ].filter(Boolean).join('\n')),
          ].join('\n'),
        }],
      }
    }
  )
}