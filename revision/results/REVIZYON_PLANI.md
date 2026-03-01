# Revizyon Planı — ReaRead Major Revision (Final Durum)

## GENEL DURUM

| Reviewer | Ağırlık | Durum |
|---|---|---|
| Reviewer 1 | Orta | ✅ Tüm sorular yanıtlandı |
| Reviewer 2 | Ağır | ✅ Tüm sorular yanıtlandı (1 kısmi) |

---

## TAMAMLANAN ÖLÇÜMLER

| # | Ölçüm | Yöntem | Sonuç |
|---|---|---|---|
| M1 | KDE vs Mean ablation | Python, 5 simüle session, 2886 nokta | KDE %25.6 daha iyi (134px vs 180px) |
| M2 | Head movement robustness | Simülasyon: 75% head-relative comp. | ±20° yaw'a kadar güvenilir (<100px) |
| M3 | End-to-end latency | companion.log, N=2177 | p50=135ms, p90=156ms |
| M4 | 5-pt vs 9-pt calibration | Literatür (Papoutsaki 2016) | 9-pt %15-20 daha iyi |
| M5 | Dwell threshold ablation | 200 simüle paragraph | F1: 0.921 vs 0.830 |
| M6 | WebGazer.js baseline | **Gerçek deney**, aynı donanım | 522px vs 25px → **%95 iyileştirme** |

---

## MAKALEYE EKLENECEK YENİ BÖLÜMLER / REVİZYONLAR

Bunlar `response_to_reviewers.md`'de tam metin olarak yazıldı. Makale dosyasına taşınacak:

1. **[NEW] Section X.X — Head Movement Robustness** — yaw offset tablosu
2. **[REVISED] Section 2.X + Figure 4** — KDE temporal açıklaması
3. **[NEW] KDE vs Mean ablation tablosu**
4. **[NEW] Discussion — KDE masking limitation paragrafı**
5. **[REVISED] 8 yazım hatası** — makale dosyasında uygulanacak
6. **[NEW] Section X.X — Ethics and Data Privacy** — tam subsection
7. **[NEW] Table X — Study Protocol** — 13 parametre
8. **[NEW] Table X — WebGazer baseline karşılaştırması**
9. **[NEW] Table X — Dwell threshold ablation (F1)**
10. **[NEW] Section X.X — Difficulty Ratio + Focus Score formülleri**
11. **[NEW] Section X.X — AI Components tablosu (LLM/TTS)**
12. **[NEW] Table X — Latency pipeline breakdown**
13. **[REVISED] "Real-time" claim → 7.6 Hz / 135ms olarak güncelleme**

---

## KALAN YAPILACAKLAR

| Görev | Durum |
|---|---|
| response_to_reviewers.md dergiye yükle | ⏳ Bekliyor |
| Makale dosyasını (Word/LaTeX) yukarıdaki 13 değişiklikle güncelle | ⏳ Bekliyor |
| Figure 4'ü güncelle (temporal KDE diyagramı) | ⏳ Bekliyor |
| Figure 3'ü vektör grafik olarak yeniden oluştur | ⏳ Bekliyor |
| Revize makaleyi dergiye gönder | ⏳ Bekliyor |
