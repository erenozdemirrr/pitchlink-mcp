# PitchLink MCP 🚀

**Girişim taslağını Notion'dan okuyup yatırımcı gözüyle analiz eden MCP server.**

VitalLink mimarisinden ilham alınarak geliştirilmiştir.

---

## Mimari

```
PitchLinkMCP/
├── server.ts              ← HTTP + MCP server (Notion bağlantısı)
├── widget.html            ← Görsel dashboard (dark theme)
├── tools/
│   ├── notion-fetch.ts    ← Notion page → düz metin
│   ├── pitch-analysis.ts  ← Bölüm bazlı analiz (Problem/Çözüm/Pazar/Ekip/Finansal)
│   ├── market-analysis.ts ← TAM/SAM/SOM değerlendirmesi
│   ├── score-calculator.ts ← Ağırlıklı yatırımcı skoru
│   └── render-feedback.ts ← Dashboard render trigger
└── package.json
```

## Kurulum

### 1. Bağımlılıkları yükle
```bash
npm install
```

### 2. Notion Integration oluştur
1. https://www.notion.so/my-integrations → "New integration"
2. **Internal integration token** al → kopyala
3. Analiz edilecek Notion sayfasına git → "..." menüsü → **"Add connections"** → integration'ını ekle

### 3. Çalıştır
```bash
NOTION_TOKEN=secret_xxxx npm run dev
```

Server `http://localhost:3000/mcp` adresinde çalışır.

---

## Claude Desktop ile Kullanım

`claude_desktop_config.json` dosyana ekle:

```json
{
  "mcpServers": {
    "pitchlink": {
      "command": "node",
      "args": ["/path/to/PitchLinkMCP/dist/server.js"],
      "env": {
        "NOTION_TOKEN": "secret_xxxx"
      }
    }
  }
}
```

---

## Tools

| Tool | Ne Yapar |
|------|----------|
| `fetch_notion_pitch` | Notion page'i okur, markdown'a çevirir |
| `analyze_pitch_sections` | Problem/Çözüm/Pazar/Ekip/Finansal analizi |
| `analyze_market_opportunity` | TAM/SAM/SOM, büyüme sinyalleri |
| `calculate_pitch_score` | Ağırlıklı 0-100 skor, harf notu |
| `render_pitch_feedback` | **SON ADIM** — görsel dashboard render |

---

## Örnek Claude Promptu

```
Bu Notion sayfamdaki girişim taslağını analiz et ve yatırımcı gözüyle 
değerlendir: https://www.notion.so/Startup-Pitch-abc123

1. fetch_notion_pitch ile sayfayı oku
2. analyze_pitch_sections ile bölümleri analiz et  
3. analyze_market_opportunity ile pazar değerlendir
4. calculate_pitch_score ile nihai skoru hesapla
5. render_pitch_feedback ile görsel dashboard'u göster
```

---

## Skorlama Sistemi

| Bölüm | Ağırlık |
|-------|---------|
| Problem-Çözüm Uyumu | %25 |
| Pazar Fırsatı | %20 |
| Ekip | %20 |
| Finansal Mantık | %15 |
| Traction & Kanıt | %10 |
| Anlatı Netliği | %10 |

**Skor → Etiket:**
- 80-100: Yatırıma Hazır 🚀
- 65-79: Güçlü Potansiyel 💪
- 50-64: Umut Verici ⚡
- 35-49: Erken Aşama 🌱
- 0-34: Önemli Revizyon Gerekiyor 🔧

---

## Geliştirme Fikirleri

- [ ] Rakip analizi tool'u (web search entegrasyonu)
- [ ] Notion database desteği (birden fazla taslak karşılaştırma)
- [ ] Haftalık progress tracking (taslak revizyon takibi)
- [ ] YC / Sequoia pitch template karşılaştırması
- [ ] Email raporu gönderme (Resend entegrasyonu)
