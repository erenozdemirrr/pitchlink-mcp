import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolContext } from '../server.js'

export interface ScoreResult {
  total: number          // 0-100
  grade: string          // A+, A, B, C, D, F
  label: string          // Fundable, Promising, etc.
  breakdown: {
    category: string
    weight: number
    score: number
    weighted: number
  }[]
  topActions: string[]   // En acil 3 eylem
  investorMemo: string   // 2 cümlelik özet
}

const WEIGHTS = {
  'Problem-Çözüm Uyumu': 0.25,
  'Pazar Fırsatı': 0.20,
  'Ekip': 0.20,
  'Finansal Mantık': 0.15,
  'Traction & Kanıt': 0.10,
  'Anlatı Netliği': 0.10,
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function scoreToLabel(score: number): string {
  if (score >= 80) return 'Yatırıma Hazır 🚀'
  if (score >= 65) return 'Güçlü Potansiyel 💪'
  if (score >= 50) return 'Umut Verici ⚡'
  if (score >= 35) return 'Erken Aşama 🌱'
  return 'Önemli Revizyon Gerekiyor 🔧'
}

export function register(server: McpServer, _ctx: ToolContext) {
  server.tool(
    'calculate_pitch_score',
    'Bölüm analizleri ve pazar analizini birleştirerek ağırlıklı nihai yatırımcı skoru hesaplar. render_pitch_feedback çağrısından önce kullanın.',
    {
      section_scores: z.object({
        problem: z.number().min(0).max(100),
        solution: z.number().min(0).max(100),
        market: z.number().min(0).max(100),
        team: z.number().min(0).max(100),
        financial: z.number().min(0).max(100),
      }).describe('Bölüm skorları (0-100)'),
      has_traction: z.boolean().default(false).describe('Taslakta traction kanıtı var mı?'),
      narrative_clarity: z.number().min(0).max(100).default(50).describe('Anlatı netliği skoru'),
      title: z.string().describe('Taslak adı'),
    },
    { readOnlyHint: true },
    async ({ section_scores, has_traction, narrative_clarity, title }) => {
      const problemSolution = (section_scores.problem + section_scores.solution) / 2
      const tractionScore = has_traction ? 75 : 20

      const breakdown = [
        { category: 'Problem-Çözüm Uyumu', weight: 0.25, score: problemSolution },
        { category: 'Pazar Fırsatı',       weight: 0.20, score: section_scores.market },
        { category: 'Ekip',                weight: 0.20, score: section_scores.team },
        { category: 'Finansal Mantık',     weight: 0.15, score: section_scores.financial },
        { category: 'Traction & Kanıt',    weight: 0.10, score: tractionScore },
        { category: 'Anlatı Netliği',      weight: 0.10, score: narrative_clarity },
      ].map(b => ({
        ...b,
        weighted: Math.round(b.score * b.weight),
      }))

      const total = Math.round(breakdown.reduce((s, b) => s + b.weighted, 0))
      const grade = scoreToGrade(total)
      const label = scoreToLabel(total)

      // En düşük 3 skoru bul → aksiyon önerileri
      const sorted = [...breakdown].sort((a, b) => a.score - b.score)
      const actionMap: Record<string, string> = {
        'Problem-Çözüm Uyumu': 'Problem ve çözüm arasındaki doğrudan bağı netleştirin; her iddiayı kullanıcı araştırmasıyla destekleyin',
        'Pazar Fırsatı': 'TAM/SAM/SOM hesaplamasını bottom-up metodla yeniden yapın ve kaynakları gösterin',
        'Ekip': 'Her kurucunun bu problemi çözmek için neden doğru kişi olduğunu açıklayın',
        'Finansal Mantık': '3 yıllık P&L ve unit economics (CAC, LTV) tablosu ekleyin',
        'Traction & Kanıt': 'Pilot müşteri, letter of intent veya beta kullanıcı verisi ekleyin',
        'Anlatı Netliği': 'Taslağı "Problem → Çözüm → Pazar → Ekip → Ask" akışına göre yeniden düzenleyin',
      }

      const topActions = sorted.slice(0, 3).map(b => actionMap[b.category])

      const investorMemo = `"${title}", ${label.toLowerCase()} kategorisinde ${total}/100 skor aldı. ` +
        `En kritik geliştirme alanları: ${sorted.slice(0, 2).map(b => b.category).join(' ve ')}.`

      const result: ScoreResult = { total, grade, label, breakdown, topActions, investorMemo }

      return {
        structuredContent: result,
        content: [
          {
            type: 'text' as const,
            text: [
              `## 🎯 Yatırımcı Skoru: ${total}/100 — ${grade} (${label})`,
              '',
              '### Ağırlıklı Breakdown',
              breakdown.map(b => `- **${b.category}** (×${b.weight}): ${b.score}/100 → ${b.weighted} puan`).join('\n'),
              '',
              `### 📋 Memo\n${investorMemo}`,
              '',
              '### 🔥 Top 3 Aksiyon',
              topActions.map((a, i) => `${i + 1}. ${a}`).join('\n'),
            ].join('\n'),
          },
        ],
      }
    }
  )
}
