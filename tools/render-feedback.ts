import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function register(server: McpServer) {
  server.tool(
    'render_pitch_feedback',
    'ZORUNLU: Analiz tamamlandıktan sonra mutlaka çağrılmalıdır. Girişim taslağı için görsel yatırımcı geri bildirim dashboard\'unu render eder. Tüm analiz araçlarını çağırdıktan sonra sentezlenmiş verileri bu tool\'a geçirin.',
    {
      title: z.string().describe('Girişim adı'),
      tagline: z.string().describe('Tek cümlelik girişim açıklaması'),
      total_score: z.number().min(0).max(100).describe('Genel yatırımcı skoru'),
      grade: z.string().describe('Harf notu: A+, A, B, C, D, F'),
      label: z.string().describe('Skor etiketi'),
      investor_memo: z.string().describe('2-3 cümlelik yatırımcı özeti'),
      section_scores: z.array(z.object({
        name: z.string(),
        score: z.number(),
        icon: z.string().describe('Emoji'),
        verdict: z.enum(['strong', 'good', 'weak', 'missing']),
      })).describe('Bölüm bazlı skorlar'),
      strengths: z.array(z.object({
        icon: z.string(),
        title: z.string(),
        detail: z.string(),
      })).describe('Güçlü yönler (maks 3)'),
      gaps: z.array(z.object({
        icon: z.string(),
        title: z.string(),
        detail: z.string(),
        priority: z.enum(['critical', 'high', 'medium']),
      })).describe('Eksikler ve kırmızı bayraklar'),
      top_actions: z.array(z.object({
        number: z.number(),
        action: z.string(),
        effort: z.enum(['quick_win', 'medium', 'hard']),
      })).describe('Öncelikli 3 aksiyon'),
      market_signals: z.object({
        tam_label: z.string().describe('TAM değeri veya "Belirtilmemiş"'),
        sam_label: z.string(),
        growth_rate: z.string().describe('Pazar büyüme oranı veya "Bilinmiyor"'),
        market_verdict: z.string(),
      }).describe('Pazar sinyalleri'),
    },
    { readOnlyHint: true },
    async (args) => {
      return {
        structuredContent: args,
        content: [
          {
            type: 'text' as const,
            text: `✅ Dashboard render edildi: "${args.title}" — ${args.total_score}/100 ${args.grade}`,
          },
        ],
      }
    }
  )
}
