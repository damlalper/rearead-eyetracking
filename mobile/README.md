# 📱 ReaRead Mobil Versiyon - Planlama Dokümanı

> **Amaç:** Desktop companion app olmadan, tarayıcıda çalışan, kalibrasyonsuz mobil eye-tracking sistemi

---

## 🎯 Hedef

**Şu anki sistem:**
- Desktop: Python app (EyeTrax) → WebSocket → Chrome Extension → 9-point calibration

**İstediğimiz sistem:**
- Mobile: MediaPipe.js (tarayıcıda) → Content Script → KALİBRASYONSUZ

---

## 🔍 Seçenekler Karşılaştırması

### **Seçenek 1: Full MediaPipe Face Mesh**
- 468 landmark + iris tracking
- Desktop kadar hassas
- ❌ Ağır (5-8MB model)
- ❌ Batarya tüketimi yüksek
- ⏱️ **Geliştirme: ~1-2 gün**

### **Seçenek 2: Lite MediaPipe** ⭐ **ÖNERİLEN**
- Sadece göz bölgesi (~33 landmark)
- Hafif (1-2MB model)
- ✅ 20+ FPS mobilde
- ✅ Paragraf-seviye tracking için yeterli
- ⏱️ **Geliştirme: ~4-6 saat**

### **Seçenek 3: Hybrid (Desktop Full + Mobile Lite)**
- Her platformda optimize
- ⏱️ **Geliştirme: ~1 gün**

### **Seçenek 4: Behavior-Based Fallback**
- Kamera gerekmez (scroll/touch tracking)
- Fallback olarak kullanılabilir
- ⏱️ **Geliştirme: ~3-4 saat**

---

## ⭐ ÖNERİ: Seçenek 2 (Lite) + Seçenek 4 (Fallback)

**Ana Sistem:** MediaPipe Lite (eye tracking)
**Fallback:** Behavior tracking (kamera izni yoksa)

---

## 🏗️ Mimari

### Dosya Yapısı
```
extension/
├── content/
│   ├── content-script.js          # MEVCUT (minimal değişiklik)
│   └── mobile/                    # YENİ
│       ├── mobile-gaze-tracker.js # MediaPipe.js wrapper
│       ├── behavior-tracker.js    # Fallback
│       └── platform-detector.js   # Mobil tespit
├── libs/                          # YENİ
│   └── mediapipe/
│       ├── face_mesh.js
│       └── *.wasm
└── manifest.json                  # camera permission ekle
```

### Akış
```
Mobil mi? → EVET
    ↓
Kamera izni var mı? → EVET
    ↓
MediaPipe Lite başlat (20 FPS)
    ↓
Kalibrasyonsuz gaze hesapla
    ↓
Content script'e gönder (mevcut handleGazeData)
    ↓
Paragraf tracking (mevcut sistem değişmez)
```

---

## 🎯 Kalibrasyonsuz Gaze Nasıl Çalışır?

### Basit Algoritma
```javascript
// 1. Göz landmarks çıkar
leftIrisCenter = landmarks[468]
rightIrisCenter = landmarks[473]

// 2. Göz merkezine göre iris offset hesapla
irisOffsetX = (iris.x - eyeCenter.x) / eyeWidth
irisOffsetY = (iris.y - eyeCenter.y) / eyeHeight

// 3. Head pose ekle
headYaw = (noseTip.x - faceCenter.x) / faceWidth
headPitch = (noseTip.y - faceCenter.y) / faceHeight

// 4. Ekrana map et (heuristic sabitler)
gazeX = screenCenter.x + (irisOffsetX * screenWidth * 0.4) + (headYaw * 150)
gazeY = screenCenter.y + (irisOffsetY * screenHeight * 0.3) + (headPitch * 100)

// 5. Smooth et
smoothedGaze = prevGaze * 0.7 + newGaze * 0.3
```

### Kritik Parametreler (Fine-tune gerekebilir)
- `GAZE_SCALE_X: 0.4` - Yatay hassasiyet
- `GAZE_SCALE_Y: 0.3` - Dikey hassasiyet
- `HEAD_YAW_SCALE: 150` - Baş dönme etkisi
- `SMOOTHING_FACTOR: 0.3` - Jitter azaltma

### Hassasiyet
- ✅ Paragraf-seviye: %80+ doğruluk
- ⚠️ Line-seviye: %60-70 doğruluk
- ❌ Kelime-seviye: Çalışmaz (kalibrasyon gerekir)

---

## 📱 Mobil Optimizasyonlar

### 1. Performans
- Batarya düşükse → FPS düşür (20→15→10)
- Sayfa background'daysa → Kamerayı kapat
- WebWorker kullan (UI thread'i bloklamaz)

### 2. UI
- Gaze cursor: 20px → **40px** (mobilde büyük)
- Help button: Sağda → **Alt ortada** (thumb-friendly)
- Alert modal: Center → **Fullscreen** (kolay kapatma)

### 3. Fallback
- Kamera yok → Behavior tracking
- Yüz algılanmıyor → Behavior tracking
- Ağ yavaş → Behavior tracking

---

## 🛠️ Uygulama Adımları

### Faz 1: Platform Tespiti (30 dakika)
```javascript
const IS_MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);
```

### Faz 2: MediaPipe.js Entegre (2 saat)
- Library ekle (`libs/mediapipe/`)
- `mobile-gaze-tracker.js` yaz
- Kamera aç/kapat

### Faz 3: Kalibrasyonsuz Mapping (2 saat)
- Yukarıdaki algoritma
- Parametre fine-tune

### Faz 4: Content Script Entegre (1 saat)
- Mobil tespit
- `handleGazeData()` ortak kullan

### Faz 5: Fallback (1.5 saat)
- `behavior-tracker.js`
- Scroll/touch events

### Faz 6: UI Optimize (1 saat)
- Responsive cursor/button
- Fullscreen alerts

### Faz 7: Test (1 saat)
- Android Chrome
- iPhone Safari
- Performans ölç

**Toplam: ~8-9 saat**

---

## 🧪 Test Checklist

- [ ] Android Chrome'da mobil mod aktif
- [ ] iPhone Safari'de mobil mod aktif
- [ ] Kamera izni verilince tracking başlıyor
- [ ] Kamera izni reddedilince fallback başlıyor
- [ ] Ekranın farklı yerlerine bakınca cursor takip ediyor
- [ ] Paragrafa bakınca highlight aktif
- [ ] 20 FPS stabil (yüksek batarya)
- [ ] Model <2 saniyede yükleniyor
- [ ] Sayfa background'a geçince kamera kapanıyor

---

## ⚡ Performans Hedefleri

| Metrik | Hedef | Kabul Edilebilir |
|--------|-------|------------------|
| FPS (High Battery) | 20+ | 15+ |
| FPS (Low Battery) | 15+ | 10+ |
| Model Load | <2s | <4s |
| Gaze Latency | <100ms | <200ms |
| Battery (1hr) | <15% | <25% |
| Paragraph Accuracy | >80% | >70% |

---

## 🚀 Sonraki Adım

**Şimdi yapılacak:**
1. Bu dokümanı oku ve onayla
2. Hangi seçeneği istediğini söyle (Seçenek 2 önerilir)
3. Branch stratejisi belirle (aynı mı, yeni mi?)
4. Geliştirmeye başla

---

## 📝 Açık Sorular

1. **Hassasiyet hedefi?**
   - Paragraf-seviye yeterli mi?
   - Line-level tracking şart mı?

2. **Hangi tarayıcılar?**
   - Chrome Mobile (Android/iOS)
   - Safari Mobile (iOS)
   - Samsung Internet
   - Firefox Mobile

3. **PWA desteği gerekli mi?**
   - Offline çalışsın mı?

4. **Hangi cihazlarda test?**
   - iPhone 14?
   - Samsung Galaxy?
   - Orta seviye Android?

---

**Hazırlayan:** Claude (Anthropic)
**Tarih:** 2026-01-04
**Durum:** Onay Bekliyor 🟡
