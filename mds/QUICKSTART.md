# ReaRead - Quick Start Guide

## 1. Companion App Kurulumu

### Gereksinimler
- Python 3.9+
- Webcam
- EyeTrax yüklü olmalı

### Kurulum Adımları

```bash
cd companion

# Virtual environment aktif et
# Windows:
.\venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate

# Bağımlılıkları kontrol et
pip list

# Gerekli paketler:
# - websockets
# - eyetrax
# - screeninfo
# - mediapipe
# - opencv-python
```

### Companion App'i Başlatma

```bash
python main.py
```

Şu çıktıyı görmelisiniz:
```
╔══════════════════════════════════════════════╗
║  ReaRead - Eye-Tracking Companion App        ║
║  Version 0.1.0                               ║
╚══════════════════════════════════════════════╝

Initializing ReaRead Companion App...
EyeTrax initialized successfully
WebSocket server: ws://localhost:8765
Waiting for browser extension to connect...
```

---

## 2. Chrome Extension Kurulumu

### Adımlar

1. Chrome'u aç
2. `chrome://extensions/` adresine git
3. Sağ üstte "Developer mode" açık olmalı
4. "Load unpacked" butonuna tıkla
5. `extension/` klasörünü seç
6. Extension yüklendi!

### Icon Dosyaları (Geçici Çözüm)

Extension icon hatası alırsanız:

1. `extension/icons/` klasörüne git
2. Herhangi bir PNG dosyasını şu isimlerle kaydet:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
   - `icon128-inactive.png`

---

## 3. İlk Test

### Adım 1: Companion App Çalıştır
```bash
cd companion
python main.py
```

### Adım 2: Extension'ı Kontrol Et

1. Chrome'da extension icon'una tıkla
2. "Connection Status" **Connected** görünmeli
3. Yeşil nokta yanıyor olmalı

### Adım 3: Gaze Tracking Test

1. Herhangi bir web sayfasını aç
2. Gözlerinizi ekranda hareket ettirin
3. Kırmızı gaze cursor görünmeli

---

## Sorun Giderme

### Companion App Bağlanmıyor

**Problem:** `Failed to initialize EyeTrax`

**Çözüm:**
```bash
pip install eyetrax
```

**Problem:** `Webcam not found`

**Çözüm:**
- Webcam bağlı olduğundan emin olun
- `config.json` içinde `camera_id: 0` yerine `camera_id: 1` deneyin

### Extension Bağlanmıyor

**Problem:** "Disconnected" durumunda kalıyor

**Çözüm:**
1. Companion app çalışıyor mu kontrol et
2. `localhost:8765` portunun açık olduğunu kontrol et
3. Extension'da "Reconnect" butonuna tıkla

### Gaze Cursor Görünmüyor

**Problem:** Cursor ekranda görünmüyor

**Çözüm:**
1. Extension popup'ta "Show Gaze Cursor" aktif mi?
2. Companion app'te gaze data akışını kontrol et
3. Browser console'da hata var mı bakın (F12)

---

## Test Senaryoları

### Basit Test

1. Google.com'a git
2. Arama kutusuna bakın → Cursor orada olmalı
3. Sonuçlara bakın → Cursor takip etmeli

### Koordinat Doğruluğu Testi

1. Boş bir sayfa aç
2. Ekranın 4 köşesine sırayla bakın
3. Cursor doğru konumda mı kontrol edin

### Çoklu Sekme Testi

1. 3 farklı sekme açın
2. Sekmeler arası geçiş yapın
3. Her sekmede cursor çalışmalı

---

## Sonraki Adımlar

✅ Temel bağlantı çalışıyor
⏳ Kalibrasyon sistemi (yakında)
⏳ Heatmap visualization (yakında)
⏳ Reading metrics dashboard (yakında)

---

## Debug Modu

### Companion App Logs

```bash
# Detaylı log için
# config.json içinde:
"logging": {
  "level": "DEBUG"
}
```

### Extension Console

```
F12 → Console
```

Gaze data akışını göreceksiniz:
```
Gaze at: DIV {x: 450, y: 320}
```

---

## Yardım

Sorun yaşarsanız:
1. Console log'larını kontrol edin
2. README.md'yi okuyun
3. GitHub Issues'da sorun açın

İyi çalışmalar! 🚀
