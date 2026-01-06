# 📱 ReaRead Mobil Versiyonu - Teknik Uygulama Planı

> **Son Güncelleme:** 2026-01-04
> **Durum:** Planlama Aşaması
> **Hedef:** Kalibrasyonsuz, tarayıcı-tabanlı mobil eye-tracking sistemi

---

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Teknik Seçenekler Karşılaştırması](#teknik-seçenekler-karşılaştırması)
3. [Önerilen Yaklaşım](#önerilen-yaklaşım)
4. [Mimari Tasarım](#mimari-tasarım)
5. [Kalibrasyonsuz Gaze Tracking](#kalibrasyonsuz-gaze-tracking)
6. [Mobil-Spesifik Optimizasyonlar](#mobil-spesifik-optimizasyonlar)
7. [Uygulama Adımları](#uygulama-adımları)
8. [Test Senaryoları](#test-senaryoları)
9. [Performans Hedefleri](#performans-hedefleri)

---

## 🎯 Genel Bakış

### Mevcut Sistem (Desktop)
```
Kullanıcı → Webcam → Python Companion App (EyeTrax/MediaPipe)
                           ↓ (WebSocket ws://localhost:8765)
                      Chrome Extension
                           ↓
                      9-point Calibration (zorunlu)
                           ↓
                      Content Script → Gaze Tracking
```

**Sorunlar:**
- ❌ Python app gerekiyor (mobilde çalışmaz)
- ❌ WebSocket bağlantısı gerekiyor
- ❌ 9-point kalibrasyon gerekiyor
- ❌ Sadece desktop Chrome'da çalışıyor

---

### Hedef Sistem (Mobile)
```
Kullanıcı → Telefon Kamerası → MediaPipe.js (tarayıcı içinde)
                                      ↓ (Direct JavaScript)
                                 Content Script
                                      ↓
                                 KALİBRASYONSUZ Gaze Estimation
                                      ↓
                                 Paragraf Tracking + LLM Yardımı
```

**Avantajlar:**
- ✅ Python app gerekmez (standalone)
- ✅ WebSocket gerekmez (local JS)
- ✅ Kalibrasyon gerekmez (heuristic mapping)
- ✅ Tüm modern mobil tarayıcılarda çalışır
- ✅ Progressive Web App (PWA) desteği

---

## 🔍 Teknik Seçenekler Karşılaştırması

### **Seçenek 1: MediaPipe Face Mesh (Full Model)**

#### Teknoloji
- **MediaPipe.js** Face Mesh solution
- 468 facial landmarks + iris tracking
- TensorFlow.js backend

#### Artıları
✅ Masaüstü kadar doğru gaze estimation
✅ Iris tracking dahil (pupil center detection)
✅ Head pose estimation doğru
✅ Mevcut Python koduna benzer sonuçlar

#### Eksileri
❌ Model boyutu: ~5-8 MB (ilk yükleme yavaş)
❌ CPU kullanımı yüksek (batarya tüketimi)
❌ Düşük/orta seviye telefonlarda yavaş (15-20 FPS)
❌ Kamera sürekli açık (privacy concern)

#### Performans Tahminleri
| Cihaz Tipi | FPS | Model Load Time | Batarya Etkisi |
|------------|-----|-----------------|----------------|
| iPhone 14+ | 25-30 | 2-3 saniye | Orta |
| Android Flagship | 20-25 | 3-4 saniye | Orta-Yüksek |
| Orta Seviye Android | 12-18 | 5-8 saniye | Yüksek |

#### Geliştirme Süresi
⏱️ **~1-2 gün** (entegrasyon + test)

---

### **Seçenek 2: Basitleştirilmiş Landmark Tracking** ⭐ **ÖNERİLEN**

#### Teknoloji
- **MediaPipe.js** Face Mesh (Lite model)
- Sadece göz bölgesi landmarks (~33 landmark)
- Minimal iris tracking

#### Artıları
✅ Hafif model: ~1-2 MB
✅ Düşük batarya tüketimi
✅ Orta seviye telefonlarda bile 20+ FPS
✅ Hızlı yükleme (1-2 saniye)
✅ Paragraf-seviye tracking için yeterli

#### Eksileri
❌ Line-level tracking hassasiyeti düşük
❌ Desktop kadar hassas değil
❌ Küçük metinlerde hata payı artabilir

#### Performans Tahminleri
| Cihaz Tipi | FPS | Model Load Time | Batarya Etkisi |
|------------|-----|-----------------|----------------|
| iPhone 14+ | 30+ | 1 saniye | Düşük |
| Android Flagship | 25-30 | 1-2 saniye | Düşük |
| Orta Seviye Android | 20-25 | 2-3 saniye | Orta |

#### Geliştirme Süresi
⏱️ **~4-6 saat** (entegrasyon + test)

---

### **Seçenek 3: Hybrid Approach (Desktop Full + Mobile Lite)**

#### Teknoloji
- Desktop: Full Face Mesh (468 landmarks) - **mevcut sistem**
- Mobile: Lite Face Mesh (33 landmarks) - **yeni sistem**
- Otomatik platform tespiti

#### Artıları
✅ Her platformda optimize performans
✅ Desktop hassasiyeti korunuyor
✅ Mobil batarya dostu
✅ Tek codebase, iki mod

#### Eksileri
⚠️ İki farklı gaze mapping logic gerekiyor
⚠️ Test karmaşıklığı artıyor

#### Geliştirme Süresi
⏱️ **~1 gün** (iki modu entegre etme)

---

### **Seçenek 4: Behavior-Based Fallback (Eye Tracking Olmadan)**

#### Teknoloji
- Scroll velocity tracking
- Touch heatmap analysis
- Dwell time monitoring
- Tab switching detection

#### Artıları
✅ Kamera gerekmez (privacy-friendly)
✅ Batarya tüketimi minimal
✅ Tüm cihazlarda çalışır
✅ Kalibrasyon gerekmez

#### Eksileri
❌ Gerçek gaze tracking değil (indirect)
❌ Hassasiyet düşük (sadece paragraf-seviye)
❌ Dikkat dağınıklığı tespiti sınırlı
❌ "Eye-tracking" özelliği kayboluyor

#### Kullanım Senaryosu
🔧 **Fallback olarak kullanılabilir:**
- Kamera erişimi reddedilirse
- Yüz algılanamıyorsa
- Batarya düşük modda

#### Geliştirme Süresi
⏱️ **~3-4 saat** (davranış analizi implementasyonu)

---

## ⭐ Önerilen Yaklaşım: **Seçenek 2 + Seçenek 4 Fallback**

### Neden Bu Kombinasyon?

1. **Seçenek 2 (Lite Face Mesh)** - Ana sistem
   - Gerçek eye-tracking sağlar
   - Mobilde performanslı
   - Paragraf-seviye tracking için yeterli

2. **Seçenek 4 (Behavior-Based)** - Fallback
   - Kamera izni yoksa çalışır
   - Yüz algılanamazsa devreye girer
   - Batarya düşükken otomatik geçer

### Akış Diyagramı
```
┌─────────────────────────────────────┐
│  Mobil cihaz tespit edildi          │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Kamera izni iste                   │
└─────────────────────────────────────┘
         ┌────┴────┐
         │ İZİN VAR│          │ İZİN YOK
         ▼         ▼          ▼
    ┌─────────┐  ┌──────────────────┐
    │ Lite FM │  │ Behavior-Based   │
    │ (Ana)   │  │ (Fallback)       │
    └─────────┘  └──────────────────┘
         │              │
         └──────┬───────┘
                ▼
      ┌──────────────────┐
      │ Content Script   │
      │ (Ortak Arayüz)   │
      └──────────────────┘
```

---

## 🏗️ Mimari Tasarım

### Dosya Yapısı
```
ReaRead2/
├── extension/
│   ├── content/
│   │   ├── content-script.js          # Ana script (MEVCUT - minimal değişiklik)
│   │   ├── llm-helper.js              # LLM integration (MEVCUT - değişiklik yok)
│   │   └── mobile/                    # YENİ klasör
│   │       ├── mobile-gaze-tracker.js # MediaPipe.js wrapper
│   │       ├── behavior-tracker.js    # Fallback tracking
│   │       └── platform-detector.js   # Mobil/desktop tespiti
│   ├── background/
│   │   └── service-worker.js          # MEVCUT (küçük değişiklik)
│   ├── libs/                          # YENİ klasör
│   │   └── mediapipe/
│   │       ├── face_mesh.js           # MediaPipe.js library
│   │       └── *.wasm                 # WASM binaries
│   ├── popup/
│   │   └── popup.html                 # MEVCUT (mobil info ekle)
│   └── manifest.json                  # Permission: camera ekle
└── mobile/
    ├── MOBILE_IMPLEMENTATION_PLAN.md  # BU DOSYA
    ├── CALIBRATION_FREE_APPROACH.md   # Kalibrasyonsuz algoritma detayı
    └── TESTING_GUIDE.md               # Test senaryoları
```

---

## 🎯 Kalibrasyonsuz Gaze Tracking

### Problem: Neden Kalibrasyon Gerekiyor?

Desktop sistemde **9-point calibration** yapıyoruz çünkü:
1. Her kullanıcının göz yapısı farklı (iris boyutu, göz aralığı)
2. Kamera açısı/mesafesi değişken
3. Ekran boyutu ve çözünürlüğü farklı

**9-point calibration** bu faktörleri öğreniyor ve kişiselleştiriyor.

---

### Çözüm: Heuristic (Kuralsal) Mapping

Mobilde kalibrasyon **kullanıcı deneyimini bozar**:
- ❌ Kullanıcı 9 noktayı takip etmek zorunda
- ❌ Telefonla zorlu (tutma pozisyonu değişir)
- ❌ Hareket sırasında kullanılamaz

**Alternatif:** Varsayılan mapping kuralları kullan

---

### Algoritma: Basitleştirilmiş Gaze Estimation

#### 1️⃣ Yüz ve Göz Tespiti
```javascript
// MediaPipe.js ile yüz landmarks
const faceLandmarks = faceMesh.process(videoFrame);

// Kritik noktalar (Face Mesh landmark indices)
const leftEyeOuter = landmarks[33];   // Sol göz dış köşe
const leftEyeInner = landmarks[133];  // Sol göz iç köşe
const rightEyeOuter = landmarks[362]; // Sağ göz dış köşe
const rightEyeInner = landmarks[263]; // Sağ göz iç köşe

// Iris merkezleri (MediaPipe refined landmarks)
const leftIrisCenter = landmarks[468];
const rightIrisCenter = landmarks[473];
```

#### 2️⃣ Göz Merkezi Hesaplama
```javascript
// Her gözün merkez noktası
const leftEyeCenter = {
  x: (leftEyeOuter.x + leftEyeInner.x) / 2,
  y: (leftEyeOuter.y + leftEyeInner.y) / 2
};

const rightEyeCenter = {
  x: (rightEyeOuter.x + rightEyeInner.x) / 2,
  y: (rightEyeOuter.y + rightEyeInner.y) / 2
};

// Göz genişliği (normalization için)
const leftEyeWidth = distance(leftEyeOuter, leftEyeInner);
const rightEyeWidth = distance(rightEyeOuter, rightEyeInner);
```

#### 3️⃣ Iris Offset Hesaplama (Normalized)
```javascript
// Iris'in göz merkezine göre konumu (normalized -1 to +1)
const leftIrisOffsetX = (leftIrisCenter.x - leftEyeCenter.x) / (leftEyeWidth / 2);
const leftIrisOffsetY = (leftIrisCenter.y - leftEyeCenter.y) / (leftEyeWidth / 2);

const rightIrisOffsetX = (rightIrisCenter.x - rightEyeCenter.x) / (rightEyeWidth / 2);
const rightIrisOffsetY = (rightIrisCenter.y - rightEyeCenter.y) / (rightEyeWidth / 2);

// İki gözün ortalaması (binocular fusion)
const avgIrisOffsetX = (leftIrisOffsetX + rightIrisOffsetX) / 2;
const avgIrisOffsetY = (leftIrisOffsetY + rightIrisOffsetY) / 2;
```

#### 4️⃣ Head Pose Estimation
```javascript
// Basit head pose (burun ucu vs yüz merkezi)
const noseTip = landmarks[1];
const faceCenterY = landmarks[151]; // Yüz merkezi (yaklaşık)

// Pitch (yukarı/aşağı bakma) - basit yaklaşım
const headPitch = (noseTip.y - faceCenterY.y) * 2;

// Yaw (sağa/sola dönme) - basit yaklaşım
const faceLeftEdge = landmarks[234];
const faceRightEdge = landmarks[454];
const faceCenterX = (faceLeftEdge.x + faceRightEdge.x) / 2;
const headYaw = (noseTip.x - faceCenterX) * 2;
```

#### 5️⃣ Ekrana Mapping (Heuristic)
```javascript
// Ekran merkezi = varsayılan bakış noktası
const screenCenterX = window.screen.width / 2;
const screenCenterY = window.screen.height / 2;

// Gaze offset hesaplama (deneysel sabitler)
const GAZE_SCALE_X = 0.4; // Yatay hassasiyet (daha düşük = daha hassas)
const GAZE_SCALE_Y = 0.3; // Dikey hassasiyet

const gazeOffsetX = avgIrisOffsetX * window.screen.width * GAZE_SCALE_X;
const gazeOffsetY = avgIrisOffsetY * window.screen.height * GAZE_SCALE_Y;

// Head pose düzeltmesi ekle
const HEAD_POSE_SCALE = 150; // pixels per unit rotation
const headOffsetX = headYaw * HEAD_POSE_SCALE;
const headOffsetY = headPitch * HEAD_POSE_SCALE;

// Final gaze koordinatları
let gazeX = screenCenterX + gazeOffsetX + headOffsetX;
let gazeY = screenCenterY + gazeOffsetY + headOffsetY;

// Ekran sınırları içinde tut
gazeX = Math.max(0, Math.min(gazeX, window.screen.width));
gazeY = Math.max(0, Math.min(gazeY, window.screen.height));
```

#### 6️⃣ Temporal Smoothing (Jitter Azaltma)
```javascript
// Exponential Moving Average (EMA)
const SMOOTHING_FACTOR = 0.3; // 0 = no smoothing, 1 = no update

smoothedGazeX = smoothedGazeX * (1 - SMOOTHING_FACTOR) + gazeX * SMOOTHING_FACTOR;
smoothedGazeY = smoothedGazeY * (1 - SMOOTHING_FACTOR) + gazeY * SMOOTHING_FACTOR;

// Küçük titreşimleri yok say (deadzone)
const DEADZONE_RADIUS = 10; // pixels
const deltaX = smoothedGazeX - prevGazeX;
const deltaY = smoothedGazeY - prevGazeY;
const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

if (distance > DEADZONE_RADIUS) {
  // Yeterince büyük hareket - güncelle
  finalGazeX = smoothedGazeX;
  finalGazeY = smoothedGazeY;
} else {
  // Çok küçük hareket - önceki değeri koru
  finalGazeX = prevGazeX;
  finalGazeY = prevGazeY;
}
```

---

### Avantajlar ve Dezavantajlar

#### ✅ Avantajlar
- **Hızlı başlangıç:** Kalibrasyon bekleme yok
- **Kullanıcı dostu:** Ekstra adım yok
- **Hareket halinde çalışır:** Telefon pozisyonu değişse bile
- **Privacy-friendly:** Kişisel veri toplanmıyor

#### ❌ Dezavantajlar
- **Hassasiyet düşük:** ±50-100px hata payı
- **Kişiselleştirilmemiş:** Herkes için aynı mapping
- **Küçük metinler zor:** Line-level tracking zorlaşıyor
- **Deneysel sabitler:** GAZE_SCALE_X/Y manuel ayar gerekebilir

#### 🎯 Uygulanabilirlik
**Paragraf-seviye tracking için yeterli:**
- ✅ Hangi paragrafı okuyor? → EVET
- ✅ Dwell time ölçümü → EVET
- ✅ Difficulty detection → EVET
- ⚠️ Hangi satırı okuyor? → YAKIN TAHMİN
- ❌ Hangi kelimeyi okuyor? → HAYIR (kalibrasyon gerekir)

---

## 📱 Mobil-Spesifik Optimizasyonlar

### 1. Performans Optimizasyonları

#### Model Lazy Loading
```javascript
// MediaPipe model'i sadece gerektiğinde yükle
if (isMobileDevice && !modelLoaded) {
  // Async yükleme - sayfayı bloklamaz
  import('./libs/mediapipe/face_mesh.js')
    .then(initializeFaceMesh)
    .catch(fallbackToBehaviorTracking);
}
```

#### Frame Rate Throttling
```javascript
// Batarya durumuna göre FPS ayarla
const battery = await navigator.getBattery();

let targetFPS;
if (battery.level < 0.2) {
  targetFPS = 10; // Düşük batarya: 10 FPS
} else if (battery.level < 0.5) {
  targetFPS = 15; // Orta batarya: 15 FPS
} else {
  targetFPS = 20; // Yüksek batarya: 20 FPS
}

const frameDelay = 1000 / targetFPS;
```

#### WebWorker Offloading
```javascript
// Ağır işlemleri worker'a gönder (UI thread'i bloklamaz)
const gazeWorker = new Worker('mobile/gaze-worker.js');

gazeWorker.postMessage({ type: 'PROCESS_FRAME', frame: imageData });

gazeWorker.onmessage = (event) => {
  const { gazeX, gazeY } = event.data;
  updateGazeCursor(gazeX, gazeY);
};
```

---

### 2. UI/UX Optimizasyonları

#### Gaze Cursor Boyutu
```javascript
// Desktop: 20px (hassas)
// Mobile: 40px (parmak dokunuşu kadar büyük)
const cursorSize = isMobileDevice ? 40 : 20;

gazeCursor.style.width = `${cursorSize}px`;
gazeCursor.style.height = `${cursorSize}px`;
```

#### Help Button Pozisyonu
```javascript
// Desktop: Paragrafın sağında
// Mobile: Alt ortada (thumb-friendly zone)
if (isMobileDevice) {
  helpButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 16px 32px; /* Daha büyük touch target */
  `;
}
```

#### Alert Modal Responsive
```javascript
if (isMobileDevice) {
  alert.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    padding: 24px;
    border-radius: 0; /* Fullscreen */
  `;
}
```

---

### 3. Kamera Yönetimi

#### Otomatik Kamera Kapatma
```javascript
// Sayfa background'a geçince kamerayı kapat (batarya tasarrufu)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGazeTracking(); // Kamera stream durdur
  } else {
    resumeGazeTracking(); // Kamera stream devam et
  }
});
```

#### Düşük Işık Tespiti
```javascript
// Çok karanlıksa kullanıcıyı uyar
function checkLightConditions(videoFrame) {
  const avgBrightness = calculateBrightness(videoFrame);

  if (avgBrightness < 30) {
    showWarning('Işık yetersiz - gaze tracking hassasiyeti düşük olabilir');
  }
}
```

---

### 4. Network Awareness

#### Offline Support
```javascript
// MediaPipe model'i cache'le (service worker)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('rearead-v1').then((cache) => {
      return cache.addAll([
        '/libs/mediapipe/face_mesh.js',
        '/libs/mediapipe/*.wasm'
      ]);
    })
  );
});
```

#### Fallback on Slow Network
```javascript
// Ağ yavaşsa fallback'e geç
const connection = navigator.connection;

if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
  console.warn('Slow network detected - using behavior-based tracking');
  useBehaviorTracking = true;
}
```

---

## 🛠️ Uygulama Adımları

### Faz 1: Platform Tespiti (30 dakika)
```javascript
// platform-detector.js
export function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;

  return {
    isMobile: /android|iphone|ipad|ipod/i.test(userAgent) || screenWidth <= 768,
    isAndroid: /android/i.test(userAgent),
    isIOS: /iphone|ipad|ipod/i.test(userAgent),
    hasCameraAccess: 'mediaDevices' in navigator,
    hasWebGL: detectWebGL(),
    batteryAPI: 'getBattery' in navigator
  };
}
```

### Faz 2: MediaPipe.js Entegrasyonu (2 saat)
1. MediaPipe library'yi `libs/mediapipe/` klasörüne ekle
2. `mobile-gaze-tracker.js` modülünü yaz
3. Lite Face Mesh konfigürasyonu
4. Kamera stream açma/kapatma

### Faz 3: Kalibrasyonsuz Gaze Mapping (2 saat)
1. Yukarıdaki algoritma implementasyonu
2. Heuristic sabitleri belirleme (GAZE_SCALE_X/Y)
3. Smoothing ve deadzone ekleme
4. Test ve fine-tuning

### Faz 4: Content Script Entegrasyonu (1 saat)
1. `content-script.js`'de mobil tespiti
2. `handleGazeData()` fonksiyonunu ortak kullanma
3. Desktop WebSocket vs Mobile direct call

### Faz 5: Fallback Sistemi (1.5 saat)
1. `behavior-tracker.js` modülü
2. Scroll/touch event listeners
3. Kamera izni yoksa otomatik geçiş

### Faz 6: UI Optimizasyonları (1 saat)
1. Responsive gaze cursor
2. Mobile-friendly help button
3. Fullscreen alert modals

### Faz 7: Test ve Debug (1 saat)
1. Farklı mobil cihazlarda test
2. Performans profiling
3. Batarya tüketimi ölçümü

**Toplam Süre:** ~8-9 saat

---

## 🧪 Test Senaryoları

### Test 1: Platform Tespiti
- [ ] Android Chrome'da mobil mod aktif
- [ ] iPhone Safari'de mobil mod aktif
- [ ] iPad'de mobil mod aktif (tablet)
- [ ] Desktop Chrome'da desktop mod aktif

### Test 2: Kamera Erişimi
- [ ] Kamera izni verildiğinde gaze tracking başlıyor
- [ ] Kamera izni reddedildiğinde behavior tracking başlıyor
- [ ] Sayfa background'a geçince kamera kapanıyor
- [ ] Sayfa foreground'a dönünce kamera açılıyor

### Test 3: Gaze Tracking Hassasiyeti
- [ ] Ekranın sol üstüne bakınca cursor sol üstte
- [ ] Ekranın sağ altına bakınca cursor sağ altta
- [ ] Ekran ortasına bakınca cursor ortada
- [ ] Başı sağa/sola çevirince offset doğru

### Test 4: Paragraf Tracking
- [ ] Paragrafa bakınca highlight aktif
- [ ] Başka paragrafa geçince eski highlight kapanıyor
- [ ] Dwell time doğru hesaplanıyor
- [ ] Difficulty detection çalışıyor

### Test 5: Performans
- [ ] 20 FPS stabil (yüksek batarya)
- [ ] 15 FPS stabil (orta batarya)
- [ ] 10 FPS stabil (düşük batarya)
- [ ] Model 2 saniyeden hızlı yükleniyor

### Test 6: Fallback Sistemi
- [ ] Kamera yoksa behavior tracking başlıyor
- [ ] Yüz algılanamazsa 5 saniye sonra fallback
- [ ] Ağ yavaşsa fallback devrede

---

## 📊 Performans Hedefleri

### Hedef Metrikler

| Metrik | Hedef | Kabul Edilebilir | Kırmızı Çizgi |
|--------|-------|------------------|---------------|
| FPS (Yüksek Batarya) | 20+ | 15+ | <10 |
| FPS (Düşük Batarya) | 15+ | 10+ | <5 |
| Model Load Time | <2s | <4s | >8s |
| Gaze Latency | <100ms | <200ms | >500ms |
| Batarya Tüketimi (1 saat) | <15% | <25% | >40% |
| Gaze Accuracy (paragraf) | >80% | >70% | <60% |

### Benchmark Cihazlar
- **iPhone 14 Pro** (High-end iOS)
- **Samsung Galaxy S21** (High-end Android)
- **Xiaomi Redmi Note 10** (Mid-range Android)

---

## 🚀 Sonraki Adımlar

### İmplementasyon Sırası
1. ✅ Bu dokümantasyonu oku ve onayla
2. ⬜ Platform tespiti kodu yaz
3. ⬜ MediaPipe.js entegre et
4. ⬜ Kalibrasyonsuz gaze mapping implementasyonu
5. ⬜ Content script entegrasyonu
6. ⬜ Fallback sistemi
7. ⬜ UI optimizasyonları
8. ⬜ Test ve fine-tuning

### Karar Noktaları
- [ ] **Seçenek 2 (Lite FM)** mi yoksa **Seçenek 1 (Full FM)** mi?
- [ ] Fallback sistemi gerekli mi?
- [ ] Hangi cihazlarda test edeceğiz?
- [ ] Branch stratejisi: Aynı branch mı, yeni branch mi?

---

## 📝 Notlar ve Sorular

### Açık Sorular
1. **Hassasiyet hedefi nedir?**
   - Paragraf-seviye yeterli mi?
   - Line-level tracking şart mı?

2. **Hangi tarayıcılar desteklenmeli?**
   - Chrome Mobile (Android/iOS)
   - Safari Mobile (iOS)
   - Samsung Internet
   - Firefox Mobile

3. **PWA desteği gerekli mi?**
   - Standalone app olarak çalışsın mı?
   - Offline mode şart mı?

4. **Privacy ayarları?**
   - Kamera akışı kayıt edilmemeli (GDPR)
   - Analytics toplanacak mı?

### Gelecek İyileştirmeler
- [ ] Opsiyonel "Quick Calibration" (5-point, 30 saniye)
- [ ] Adaptive smoothing (hareket hızına göre)
- [ ] Multi-language support (alerts)
- [ ] Dark mode optimization

---

**Son Güncelleme:** 2026-01-04
**Hazırlayan:** Claude (Anthropic)
**Durum:** Onay Bekliyor 🟡
