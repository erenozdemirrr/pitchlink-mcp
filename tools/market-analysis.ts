import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolContext } from '../server.js'

export interface MarketInsight {
  estimatedTAM: string | null
  estimatedSAM: string | null
  growthSignals: string[]
  redFlags: string[]
  benchmarks: string[]
  verdict: string
}

/** Metinden sayısal pazar değerlerini yakalar */
function extractMarketNumbers(text: string): { value: number; unit: string; context: string }[] {
  const results: { value: number; unit: string; context: string }[] = []
  const pattern = /(\d[\d.,]*)\s*(milyon|milyar|million|billion|M|B|K)\s*(dolar|\$|₺|TL|USD|EUR)?/gi
  let match

  while ((match = pattern.exec(text)) !== null) {
    const raw = parseFloat(match[1].replace(/,/g, ''))
    const unit = match[2].toLowerCase()
    const multiplier = ['milyar', 'billion', 'b'].includes(unit) ? 1000 : 1
    results.push({
      value: raw * multiplier,
      unit: match[3] ?? 'M',
      context: text.slice(Math.max(0, match.index - 30), match.index + 60),
    })
  }

  return results
}

export function register(server: McpServer, _ctx: ToolContext) {
  server.tool(
    'analyze_market_opportunity',
    'Taslaktaki pazar büyüklüğü iddialarını değerlendirir, TAM/SAM/SOM tutarlılığını kontrol eder ve sektör benchmark\'larıyla karşılaştırır.',
    {
      content: z.string().describe('Taslak içeriği'),
      sector: z.string().optional().describe('Sektör (ör: fintech, SaaS, e-ticaret, sağlık)'),
    },
    { readOnlyHint: true },
    async ({ content, sector }) => {
      const numbers = extractMarketNumbers(content)
      const lower = content.toLowerCase()

      const hasTAM = /\bTAM\b/i.test(content)
      const hasSAM = /\bSAM\b/i.test(content)
      const hasSOM = /\bSOM\b/i.test(content)
      const hasBottomUp = /bottom.up|aşağıdan|birim başına/i.test(content)
      const hasGrowthRate = /CAGR|büyüme oranı|growth rate|%\s*\d+/i.test(content)

      const growthSignals: string[] = []
      const redFlags: string[] = []

      if (hasTAM && hasSAM && hasSOM) growthSignals.push('TAM/SAM/SOM çerçevesi tam kullanılmış')
      if (hasBottomUp) growthSignals.push('Bottom-up pazar hesaplaması mevcut')
      if (hasGrowthRate) growthSignals.push('Pazar büyüme oranı belirtilmiş')
      if (numbers.length >= 2) growthSignals.push(`${numbers.length} adet sayısal pazar verisi`)

      if (!hasTAM) redFlags.push('TAM tanımlanmamış')
      if (!hasSAM) redFlags.push('SAM (ulaşılabilir pazar) yok')
      if (!hasSOM) redFlags.push('SOM (hedeflenen pazar payı) yok')
      if (!hasBottomUp) redFlags.push('Sadece top-down kaynak kullanılmış gibi görünüyor')
      if (numbers.length === 0) redFlags.push('Hiç sayısal pazar verisi yok')

      // Basit TAM/SAM tespiti
      const estimatedTAM = numbers.length > 0
        ? `~${numbers[0].value}M ${numbers[0].unit} (taslaktan)`
        : null
      const estimatedSAM = numbers.length > 1
        ? `~${numbers[1].value}M ${numbers[1].unit} (taslaktan)`
        : null

      // Sektör benchmarkları
      const sectorBenchmarks: Record<string, string[]> = {
        fintech: ['Türkiye fintech pazarı ~$2B (2024)', 'Küresel fintech CAGR %25+', 'Tipik SaaS LTV/CAC: 3x+'],
        saas: ['SaaS CAC payback süresi <12 ay iyi kabul edilir', 'Yıllık churn <%5 sağlıklı', 'NRR >110% güçlü büyüme'],
        eticaret: ['Türkiye e-ticaret $35B+ (2024)', 'Konversiyon oranı %1-3 tipik', 'AOV artışı key metric'],
        saglik: ['Türkiye sağlık harcaması GDP\'nin %4.6\'sı', 'HealthTech CAGR %28 (küresel)'],
      }

      const sectorKey = Object.keys(sectorBenchmarks).find(k =>
        sector?.toLowerCase().includes(k) || lower.includes(k)
      )
      const benchmarks = sectorKey ? sectorBenchmarks[sectorKey] : [
        'Yatırımcılar genellikle $1B+ TAM arar (seed için $100M+ SAM yeterli olabilir)',
        'Pazar büyüklüğünü mutlaka kaynakla destekleyin (Statista, McKinsey, vb.)',
      ]

      const score = (hasTAM ? 20 : 0) + (hasSAM ? 20 : 0) + (hasSOM ? 15 : 0) +
                    (hasBottomUp ? 25 : 0) + (hasGrowthRate ? 20 : 0)

      const verdict = score >= 70
        ? 'Pazar analizi yatırımcı düzeyine yakın ✅'
        : score >= 40
        ? 'Pazar analizi mevcut ama derinleştirme gerekiyor ⚠️'
        : 'Pazar analizi yetersiz — yatırımcı soruları yanıtsız kalacak ❌'

      const insight: MarketInsight = {
        estimatedTAM,
        estimatedSAM,
        growthSignals,
        redFlags,
        benchmarks,
        verdict,
      }

      return {
        structuredContent: { ...insight, score, hasTAM, hasSAM, hasSOM },
        content: [
          {
            type: 'text' as const,
            text: [
              `## 📊 Pazar Analizi (${score}/100)`,
              `**Karar:** ${verdict}`,
              '',
              growthSignals.length ? `**✅ Güçlü Sinyaller:**\n${growthSignals.map(s => `- ${s}`).join('\n')}` : '',
              redFlags.length ? `**⚠️ Kırmızı Bayraklar:**\n${redFlags.map(r => `- ${r}`).join('\n')}` : '',
              '',
              `**Sektör Benchmarkları:**\n${benchmarks.map(b => `- ${b}`).join('\n')}`,
            ].filter(Boolean).join('\n'),
          },
        ],
      }
    }
  )
}
