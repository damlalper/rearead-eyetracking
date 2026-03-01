# ReaRead için EyeTrax Kullanım Kılavuzu

## 📋 ÖNEMLİ ÖZET: Neye İhtiyacın Var, Neye Yok?

### ✅ KULLANACAĞIN (CORE - %70 gerekli)

| Modül | Dosya | ReaRead'de Kullanımı | Öncelik |
|-------|-------|---------------------|---------|
| **GazeEstimator** | `gaze.py` | ⭐⭐⭐ CORE - Gaze tahmin engine'in | 🔴 Kritik |
| **Calibration** | `calibration/nine_point.py` | ⭐⭐⭐ Kullanıcı kalibrasyonu | 🔴 Kritik |
| **Models** | `models/ridge.py` (veya tiny_mlp) | ⭐⭐⭐ Gaze prediction ML modeli | 🔴 Kritik |
| **Constants** | `constants.py` | ⭐⭐ Landmark indices (değiştirme) | 🟡 Gerekli |
| **Screen Utils** | `utils/screen.py` | ⭐ Screen size almak için | 🟢 Opsiyonel |

### ❌ KULLANMAYACAĞIN (Extension tarafında yapılacak)

| Modül | Dosya | Neden Gereksiz | Alternatif |
|-------|-------|----------------|-----------|
| **Filters** | `filters/kalman.py`, `kde.py` | Extension'da smoothing yapacaksın | JavaScript'te implement et |
| **Demo App** | `app/demo.py` | Kendi companion app yazacaksın | WebSocket server |
| **VirtualCam** | `app/virtualcam.py` | ReaRead'de virtual camera yok | - |
| **Draw Utils** | `utils/draw.py` | Extension'da Canvas ile çizeceksin | JavaScript Canvas API |
| **Video Utils** | `utils/video.py` | Kendi video capture yazacaksın | OpenCV direkt kullan |
| **CLI Parser** | `cli.py` | Kendi config yapacaksın | JSON config |

### ⚠️ ADAPT EDECEĞİN (Modifiye kullanacaksın)

| Modül | Neden Değişecek | Nasıl Kullanacaksın |
|-------|----------------|---------------------|
| **Calibration** | ✏️ Kendi UI'ında çalıştıracaksın | `run_9_point_calibration()` fonksiyonunu çağır |
| **Model Save/Load** | ✏️ Kullanıcı bazlı kaydedeceksin | `user_123_model.pkl` gibi |

---

## 🎯 REAREAD İÇİN EYETRAX KULLANIM REHBERİ

### 1️⃣ CORE SINIF: GazeEstimator

**Senin için en önemli sınıf!**

```python
from eyetrax import GazeEstimator

# Companion App'te kullanım
estimator = GazeEstimator(
    model_name="ridge",  # veya "tiny_mlp" (daha accurate)
    model_kwargs={},
    ear_history_len=50,  # Blink detection için
    blink_threshold_ratio=0.8,
    min_history=15
)
```

#### **Ne Yapıyor?**

1. **MediaPipe FaceMesh** ile yüz landmark'ları buluyor (468 nokta)
2. **Göz bölgesi landmark'larını** normalize ediyor (baş pozisyonuna göre)
3. **Blink detection** yapıyor (EAR - Eye Aspect Ratio)
4. Trained model ile **gaze koordinatları** tahmin ediyor

#### **Metodlar (Senin kullanacakların):**

##### `extract_features(frame)`
```python
features, blink = estimator.extract_features(frame)

# features: 131 boyutlu NumPy array
#   - 128D: Göz landmark'ları (normalize, head-relative)
#   - 3D: Head pose (yaw, pitch, roll)
# blink: True/False (göz kapalı mı?)
```

**Ne zaman kullanılır:** Her frame'de, gaze predict etmeden önce

**ReaRead'de kullanım:**
```python
ret, frame = cap.read()
features, blink = estimator.extract_features(frame)

if features is not None and not blink:
    # Gaze predict et ve WebSocket'e gönder
    x, y = estimator.predict([features])[0]
    await websocket.send(json.dumps({
        "x": int(x), "y": int(y), "confidence": 0.8
    }))
```

##### `train(X, y, variable_scaling=None)`
```python
# Calibration'dan gelen verilerle training
estimator.train(X_features, y_gaze_coords)
```

**Ne zaman kullanılır:** Calibration tamamlandığında

##### `predict(X)`
```python
gaze_coords = estimator.predict([features])
# gaze_coords: [[x, y]] şeklinde array
x, y = gaze_coords[0]
```

**Ne zaman kullanılır:** Her frame'de (features extract edildikten sonra)

##### `save_model(path)` / `load_model(path)`
```python
# Calibration sonrası kaydet
estimator.save_model("users/user_123_model.pkl")

# Daha sonra yükle
estimator = GazeEstimator()
estimator.load_model("users/user_123_model.pkl")
```

**Ne zaman kullanılır:**
- Save: Calibration bittikten sonra
- Load: Companion app başlangıcında (eğer model varsa)

---

### 2️⃣ CALIBRATION MODÜLÜ

**Kullanıcıdan gaze training data toplamak için**

#### **Hangi Calibration'ı Kullanmalısın?**

| Method | Dosya | Süre | Accuracy | Kullanım Senaryosu |
|--------|-------|------|----------|-------------------|
| **9-point** ✅ | `calibration/nine_point.py` | ~45 sn | ⭐⭐⭐ Yüksek | **İlk calibration (öner)** |
| 5-point | `calibration/five_point.py` | ~30 sn | ⭐⭐ Orta | Quick re-calibration |
| Lissajous | `calibration/lissajous.py` | ~25 sn | ⭐⭐ Orta | Daha doğal, smooth |
| Adaptive | `calibration/adaptive.py` | ~2-3 dk | ⭐⭐⭐⭐ Çok yüksek | İleri seviye (3 hafta sonra ekle) |

**ÖNERİ:** MVP için **9-point** kullan!

#### **Kod Örneği:**

```python
from eyetrax.calibration import run_9_point_calibration

# Companion app'te calibration trigger
def start_calibration():
    estimator = GazeEstimator()
    run_9_point_calibration(
        estimator,
        camera_index=0
    )
    # Bu fonksiyon bittikinde estimator.model trained oluyor!

    # Modeli kaydet
    estimator.save_model(f"users/{user_id}_model.pkl")

    return estimator
```

#### **Calibration Flow (Kullanıcı ne görecek?):**

1. **Fullscreen window açılır** (OpenCV)
2. **"Press SPACE to start"** mesajı
3. **Her point için:**
   - Kırmızı nokta büyür-küçülür (pulse animation)
   - Kullanıcı noktaya bakar
   - 3-2-1 countdown
   - Gaze data toplanır
4. **9 nokta tamamlanınca:**
   - Model train edilir
   - Window kapanır

**SORUN:** EyeTrax calibration kendi window'unu açıyor (fullscreen OpenCV)

**ÇÖZÜM (3 seçenek):**

**A) Olduğu gibi kullan (ÖNERİLEN - MVP için)** ✅
- Pro: Sıfır kod değişikliği
- Pro: Çalışan sistem
- Con: Kullanıcı deneyimi biraz jarring (fullscreen geçiş)

**B) Calibration'ı kendi window'unda çalıştır (Sonraya bırak)**
- `calibration/common.py` dosyasını fork et
- Kendi UI framework'ünde çalıştır
- Zaman alır (3 gün+)

**C) Extension'dan calibration noktaları göster (Advanced)**
- Companion app sadece veri toplar
- Extension browser'da calibration UI gösterir
- Karmaşık koordinasyon gerekir

**MVP İÇİN:** Seçenek A! (OpenCV fullscreen kullan)

---

### 3️⃣ MODELS MODÜLÜ

**Gaze prediction için ML modelleri**

#### **Hangi Modeli Kullanmalısın?**

| Model | Hız | Accuracy | Kullanım |
|-------|-----|----------|----------|
| **ridge** (default) | ⚡⚡⚡ Çok hızlı | ⭐⭐ İyi | **MVP için öner** ✅ |
| elastic_net | ⚡⚡ Hızlı | ⭐⭐ İyi | Alternatif |
| svr | ⚡ Yavaş | ⭐⭐⭐ Daha iyi | CPU yoğun |
| **tiny_mlp** | ⚡⚡ Hızlı | ⭐⭐⭐ Daha iyi | **Production'da kullan** 🎯 |

**ÖNERİ:**
- **Hafta 1-2:** `ridge` kullan (basit, hızlı)
- **Hafta 3:** `tiny_mlp` dene (daha accurate)

```python
# Ridge (default)
estimator = GazeEstimator(model_name="ridge")

# TinyMLP (daha accurate)
estimator = GazeEstimator(
    model_name="tiny_mlp",
    model_kwargs={
        "hidden_layer_sizes": (64, 32),
        "max_iter": 300,
        "early_stopping": True
    }
)
```

**Model Switching:** Kolay! Sadece `model_name` değiştir.

---

### 4️⃣ FILTERS MODÜLÜ (❌ KULLANMA!)

**Bu modülü ReaRead'de kullanmayacaksın!**

**Neden?**
- Smoothing **extension tarafında** yapılacak (JavaScript)
- Daha düşük latency (network hop yok)
- Daha esnek (browser viewport'a özel filtering)

**EyeTrax Filters:**
- `KalmanSmoother`: Velocity-based prediction
- `KDESmoother`: Spatial density smoothing
- `NoSmoother`: Pass-through

**ReaRead'de ne yapacaksın:**
Extension'da **JavaScript ile smooth edeceksin**:

```javascript
// Simple moving average (extension'da)
class GazeSmoother {
  constructor(windowSize = 5) {
    this.history = [];
    this.windowSize = windowSize;
  }

  smooth(x, y) {
    this.history.push({x, y});
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    const avgX = this.history.reduce((sum, p) => sum + p.x, 0) / this.history.length;
    const avgY = this.history.reduce((sum, p) => sum + p.y, 0) / this.history.length;

    return {x: avgX, y: avgY};
  }
}
```

**VEYA Kalman filter'ı JavaScript'e port et** (3. hafta)

---

### 5️⃣ UTILS MODÜLÜ

#### **utils/screen.py** - ✅ Kullan

```python
from eyetrax.utils.screen import get_screen_size

screen_width, screen_height = get_screen_size()
# Örnek: (1920, 1080)
```

**Ne zaman kullanılır:**
- Companion app başlangıcında
- Screen resolution'ı extension'a göndermek için

```python
# WebSocket message'ında
await websocket.send(json.dumps({
    "type": "gaze",
    "x": x,
    "y": y,
    "screen_width": screen_width,
    "screen_height": screen_height
}))
```

#### **utils/draw.py** - ❌ Kullanma

OpenCV drawing fonksiyonları. Extension'da Canvas API ile yapacaksın.

#### **utils/video.py** - ❌ Kullanma

Video utilities (fullscreen window, context managers). Kendi yazacaksın.

---

### 6️⃣ APP MODÜLÜ (❌ Direkt kullanma, sadece referans)

#### **app/demo.py** - 📖 Referans olarak oku

**Faydalı kısımlar:**
- GazeEstimator nasıl initialize edilir?
- Calibration nasıl çağrılır?
- Video loop nasıl yazılır?

**Kopyalayacağın kod blokları:**

```python
# Model yükleme/calibration logic
if os.path.isfile(model_file):
    estimator.load_model(model_file)
else:
    run_9_point_calibration(estimator, camera_index=0)

# Video loop template
cap = cv2.VideoCapture(camera_index)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    features, blink = estimator.extract_features(frame)

    if features is not None and not blink:
        x, y = estimator.predict([features])[0]
        # WebSocket'e gönder
        await broadcast_gaze(int(x), int(y))

    # Frame rate control
    time.sleep(1/30)  # 30 FPS
```

#### **app/virtualcam.py** - ❌ Skip

Virtual camera için, ReaRead'de yok.

#### **app/build_model.py** - 📖 Referans

Model training tool. Adaptive calibration örneği için bak.

---

## 🎯 REAREAD COMPANION APP İÇİN EYETRAX KULLANIM ŞEMASİ

### Minimal Companion App (Skeleton)

```python
import asyncio
import json
import time
import cv2
import websockets
from eyetrax import GazeEstimator, run_9_point_calibration
from eyetrax.utils.screen import get_screen_size

class ReaReadCompanion:
    def __init__(self, user_id="default"):
        self.user_id = user_id
        self.model_path = f"users/{user_id}_model.pkl"
        self.estimator = GazeEstimator(model_name="ridge")
        self.screen_width, self.screen_height = get_screen_size()
        self.camera_index = 0
        self.connected_clients = set()

        # Model yükle veya calibrate et
        if os.path.isfile(self.model_path):
            print(f"Loading model: {self.model_path}")
            self.estimator.load_model(self.model_path)
            self.is_calibrated = True
        else:
            print("No model found. Please calibrate.")
            self.is_calibrated = False

    async def calibrate(self):
        """Calibration'ı başlat"""
        print("Starting 9-point calibration...")
        run_9_point_calibration(self.estimator, camera_index=self.camera_index)
        self.estimator.save_model(self.model_path)
        self.is_calibrated = True
        print(f"Calibration complete. Model saved: {self.model_path}")

    async def broadcast_gaze(self, x, y, confidence):
        """Gaze verisini tüm bağlı clientlara gönder"""
        if not self.connected_clients:
            return

        message = json.dumps({
            "type": "gaze",
            "x": x,
            "y": y,
            "confidence": confidence,
            "timestamp": int(time.time() * 1000),
            "screen_width": self.screen_width,
            "screen_height": self.screen_height
        })

        websockets.broadcast(self.connected_clients, message)

    async def gaze_stream_loop(self):
        """Ana gaze streaming loop"""
        cap = cv2.VideoCapture(self.camera_index)
        last_send_time = 0
        min_interval = 1/30  # 30 Hz

        print("Starting gaze stream...")

        while True:
            ret, frame = cap.read()
            if not ret:
                continue

            if not self.is_calibrated:
                await asyncio.sleep(0.1)
                continue

            features, blink = self.estimator.extract_features(frame)

            if features is not None and not blink:
                gaze = self.estimator.predict([features])[0]
                x, y = int(gaze[0]), int(gaze[1])

                # Rate limiting
                current_time = time.time()
                if current_time - last_send_time >= min_interval:
                    await self.broadcast_gaze(x, y, confidence=0.8)
                    last_send_time = current_time

            await asyncio.sleep(0.001)  # Prevent blocking

        cap.release()

    async def websocket_handler(self, websocket, path):
        """WebSocket bağlantı handler"""
        self.connected_clients.add(websocket)
        print(f"Client connected. Total: {len(self.connected_clients)}")

        # İlk bağlantıda status gönder
        await websocket.send(json.dumps({
            "type": "status",
            "calibrated": self.is_calibrated,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height
        }))

        try:
            async for message in websocket:
                data = json.loads(message)

                if data["type"] == "calibration_request":
                    await self.calibrate()
                    await websocket.send(json.dumps({
                        "type": "calibration_complete"
                    }))

                elif data["type"] == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": data.get("timestamp")
                    }))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.connected_clients.remove(websocket)
            print(f"Client disconnected. Total: {len(self.connected_clients)}")

    async def start(self):
        """Companion app'i başlat"""
        # WebSocket server
        server = await websockets.serve(
            self.websocket_handler,
            "localhost",
            8765
        )

        print("ReaRead Companion started!")
        print("WebSocket server: ws://localhost:8765")

        # Gaze streaming task
        stream_task = asyncio.create_task(self.gaze_stream_loop())

        # Run forever
        await asyncio.Future()

# Ana program
if __name__ == "__main__":
    companion = ReaReadCompanion(user_id="user_123")
    asyncio.run(companion.start())
```

---

## 📦 GEREKLİ PAKETLER (requirements.txt)

```txt
# EyeTrax dependencies (zaten var)
opencv-python>=4.5
mediapipe>=0.10
numpy>=1.22,<2.0  # ÖNEMLİ: NumPy 2.x uyumsuzluğu var!
scikit-learn>=1.3
scipy>=1.10
screeninfo>=0.8

# ReaRead ek dependencies
websockets>=12.0  # WebSocket server için

# Opsiyonel (system tray için - 3. hafta)
# pystray>=0.19
# pillow>=10.0
```

---

## 🚨 DİKKAT EDİLMESİ GEREKENLER

### 1. NumPy Version Lock! ⚠️

**EyeTrax şu anda NumPy < 2.0 gerektirir!**

```bash
pip install "numpy<2.0"
```

Zaten düzelttik, ama production'da requirements.txt'e ekle.

### 2. MediaPipe Uyumluluğu

`gaze.py` dosyasında MediaPipe versiyonları için try-except var. Dokunma!

```python
# Bu kod zaten var, değiştirme
try:
    self.face_mesh = mp.solutions.face_mesh.FaceMesh(...)
except AttributeError:
    # Yeni API fallback
    ...
```

### 3. Calibration Window Blocking

`run_9_point_calibration()` **senkron** ve **blocking** bir fonksiyon!

**Sorun:** WebSocket server blocking olur.

**Çözüm:**

```python
# Calibration'ı ayrı thread'de çalıştır
import threading

def calibrate_in_thread():
    run_9_point_calibration(estimator, camera_index=0)
    estimator.save_model(model_path)

# WebSocket handler'da
if data["type"] == "calibration_request":
    thread = threading.Thread(target=calibrate_in_thread)
    thread.start()
```

VEYA (daha iyi):

```python
# asyncio.to_thread kullan (Python 3.9+)
async def calibrate(self):
    await asyncio.to_thread(
        run_9_point_calibration,
        self.estimator,
        camera_index=self.camera_index
    )
    self.estimator.save_model(self.model_path)
```

### 4. Camera Access Conflicts

**Sadece bir process kamerayı kullanabilir!**

Companion app kamera açtığında, EyeTrax demo vs. çalıştırma.

### 5. Model File Paths

User-specific model dosyaları için klasör yapısı:

```
rearead_companion/
├── main.py
├── users/
│   ├── user_123_model.pkl
│   ├── user_456_model.pkl
│   └── default_model.pkl
└── config.json
```

```python
import os

os.makedirs("users", exist_ok=True)
model_path = f"users/{user_id}_model.pkl"
```

---

## 🎯 ÖZET: REAREAD İÇİN EYETRAX KULLANIM KONTROL LİSTESİ

### ✅ Kullanacağın (MUST USE)
- [x] `GazeEstimator` class
  - `extract_features(frame)`
  - `predict([features])`
  - `save_model(path)`
  - `load_model(path)`
- [x] `run_9_point_calibration(estimator, camera_index)`
- [x] `models.ridge.RidgeModel` (veya tiny_mlp)
- [x] `utils.screen.get_screen_size()`
- [x] `constants.py` (dokunma, olduğu gibi kullan)

### ❌ Kullanmayacağın (SKIP)
- [ ] `filters/` (Extension'da yapacaksın)
- [ ] `app/demo.py` (Referans için oku)
- [ ] `app/virtualcam.py` (Gereksiz)
- [ ] `utils/draw.py` (Extension Canvas)
- [ ] `utils/video.py` (Kendi yazacaksın)
- [ ] `cli.py` (Kendi config'in)

### 📖 Referans olarak okuyacağın
- [ ] `app/demo.py` - Video loop nasıl yazılır
- [ ] `calibration/adaptive.py` - İleri seviye (sonra)

### ⚠️ Değiştirecek/Adapt edeceksin
- [ ] Calibration'ı thread'de çalıştır (blocking olmasın)
- [ ] Model dosyaları user_id bazlı kaydet
- [ ] WebSocket ile integrate et

---

## 🚀 İLK ADIM (ŞİMDİ YAP!)

**Test et ki EyeTrax'i anladın:**

```python
# test_eyetrax.py
from eyetrax import GazeEstimator
import cv2

# 1. GazeEstimator oluştur
estimator = GazeEstimator(model_name="ridge")

# 2. Kamerayı aç
cap = cv2.VideoCapture(0)

print("Press 'c' to calibrate")
print("Press 'q' to quit")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # 3. Features extract et
    features, blink = estimator.extract_features(frame)

    if features is not None:
        print(f"Features shape: {features.shape}, Blink: {blink}")

        # Eğer calibrated ise predict et
        if hasattr(estimator.model, 'is_trained'):
            try:
                x, y = estimator.predict([features])[0]
                print(f"Gaze: ({x:.0f}, {y:.0f})")
            except:
                print("Model not trained yet")

    cv2.imshow("EyeTrax Test", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('c'):
        print("Starting calibration...")
        from eyetrax.calibration import run_9_point_calibration
        run_9_point_calibration(estimator, camera_index=0)
        print("Calibration complete!")
    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
```

**Çalıştır:**
```bash
python test_eyetrax.py
```

**Beklenen çıktı:**
1. Kamera açılır
2. "Features shape: (131,), Blink: False" gibi output
3. 'c' tuşuna basınca calibration başlar
4. Calibration sonrası gaze koordinatları print olur

**Bu çalışırsa:** EyeTrax'i anladın demektir! ✅

---

## 📞 YARDIM

**Takılırsan:**

1. **EyeTrax dokümantasyonu:** https://github.com/ck-zhang/EyeTrax
2. **MediaPipe Face Mesh:** https://google.github.io/mediapipe/solutions/face_mesh
3. **Scikit-learn docs:** https://scikit-learn.org/

**Common errors:**

- **"ModuleNotFoundError: No module named 'eyetrax'"**
  → `pip install -e .` (EyeTrax klasöründe)

- **"Camera not found"**
  → `camera_index=0` yerine `1` dene

- **"Model not trained"**
  → Önce calibration yap

- **NumPy uyumsuzluğu**
  → `pip install "numpy<2.0"`

---

**REAREAD'DE EYETRAX KULLANIMI BU KADAR! 🎉**

Sorular?
