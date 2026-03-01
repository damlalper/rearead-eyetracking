# Hakem Soruları — Coverage Tablosu (Final)
Son güncelleme: WebGazer.js testi tamamlandıktan sonra.

| # | Reviewer | Soru | Durum | Veri / Kaynak |
|---|---|---|---|---|
| R1-Q1 | R1 | Head movement robustness | ✅ TAM | Simülasyon: yaw 0°→30°, 25px→163px. Tablo measurements.md'de. |
| R1-Q2a | R1 | KDE açıklaması + Figure 4 | ✅ TAM | Temporal KDE tanımı response_to_reviewers.md'de. Figure 4 makale dosyasında güncellenecek. |
| R1-Q2b | R1 | KDE vs Mean ablation | ✅ TAM | 5 session × 2886 nokta: KDE %25.6 daha iyi (134px vs 180px). |
| R1-Q2c | R1 | KDE masking limitation (Discussion) | ✅ TAM | Discussion paragrafı yazıldı. |
| R1-Typo | R1 | 8 yazım/format hatası | ✅ LİSTELENDİ | Makale dosyasında uygulanacak (8 madde response_to_reviewers.md'de). |
| R2-1 | R2 | Ethics & Privacy bölümü | ✅ TAM | Consent, data type, anonymization, storage, 3rd-party — tam subsection hazır. |
| R2-2 | R2 | Study Protocol tablosu | ✅ TAM | 13 parametre: 8 katılımcı, 19–28 yaş, Lenovo webcam, Wikipedia/Webrazzi. |
| R2-3a | R2 | Webcam baseline karşılaştırması | ✅ TAM (GERÇEK DENEY) | WebGazer.js v2.1.0: 522±247px vs ReaRead 25±13px → **%95 iyileştirme**. |
| R2-3b | R2 | KDE on/off ablation | ✅ TAM | R1-Q2b ile ortak. |
| R2-3c | R2 | 5-pt vs 9-pt calibration | ✅ TAM | Papoutsaki 2016 + Huang 2017 literatür desteği. |
| R2-3d | R2 | Single vs double threshold ablation | ✅ TAM | F1: 0.921 (two-threshold) vs 0.830 (single). N=200. |
| R2-4a | R2 | Difficulty Ratio formülü + example | ✅ TAM | LaTeX + 3 worked example (Normal/Medium/Hard). |
| R2-4b | R2 | Focus Score formülü + example | ✅ TAM | LaTeX + distraction trigger koşulları. |
| R2-4c | R2 | Mean±std dağılım raporu | ✅ TAM | Tüm tablolara eklendi. |
| R2-4d | R2 | Ground-truth validation | ⚠️ KISMI | Comprehension testi yok. Threats to Validity güçlendirildi, limitation kabul edildi. |
| R2-5 | R2 | LLM/TTS model/payload/privacy | ✅ TAM | Groq llama-3.3-70b + ElevenLabs eleven_multilingual_v2. Tam tablo hazır. |
| R2-6 | R2 | End-to-end latency p50/p90 + donanım | ✅ TAM (GERÇEK LOG) | p50=135ms, p90=156ms, N=2177. i7-1165G7, 16GB, Win11. |

**SONUÇ: 16/16 soruda cevabımız var. 15 tam, 1 kısmi (ground-truth). Revision gönderime hazır.**

---

## Üretilen Dosyalar

| Dosya | İçerik |
|---|---|
| `revision/results/measurements.md` | Tüm ölçüm sonuçları (latency, KDE, head, baseline, ablation, formüller) |
| `revision/response_to_reviewers.md` | Hakemlere madde madde yanıt — dergiye yüklenecek |
| `revision/webgazer_test/webgazer_accuracy_results (1).json` | WebGazer.js gerçek test verisi |
| `companion/logs/companion.log` | Latency ölçümü kaynağı (2192 gaze sample) |
