# ReaRead Debug Guide - Gaze Cursor Çalışmıyor

## 🎯 Sorun Tespit Adımları

Lütfen bu adımları **SIRASIYLA** takip edin ve her adımın sonucunu not edin.

---

## ADIM 1: Companion App Testi

### 1.1 Temiz Başlangıç

```bash
# Eski model dosyasını silin
cd companion
rm -f users/default_model.pkl

# VEYA Windows'ta:
del users\default_model.pkl
```

### 1.2 Companion App Başlatın

```bash
python main.py
```

**SORU 1:** Log'da ne görüyorsunuz?

✅ Olması gereken:
```
Initializing ReaRead Companion App...
EyeTrax initialized successfully
Logging level set to: DEBUG
No model found - calibration required
WebSocket server: ws://localhost:8765
Waiting for browser extension to connect...
```

❌ Hata varsa buraya yazın:
```
[Hata mesajını buraya yazın]
```

---

## ADIM 2: Extension Bağlantı Testi

### 2.1 Extension'ı Yükleyin/Yenileyin

1. Chrome'da: `chrome://extensions/`
2. ReaRead extension'ı bulun
3. "Yenile" butonuna basın (🔄)

### 2.2 Companion App Log Kontrolü

**SORU 2:** Companion app terminalinde ne görüyorsunuz?

✅ Olması gereken:
```
Client connected. Total clients: 1
Sent initial status: calibrated=False
```

❌ Hiçbir şey yazmıyorsa:
- WebSocket bağlantısı yok!
- Port 8765 açık mı kontrol edin: `netstat -an | findstr 8765`

---

## ADIM 3: Calibration Testi

### 3.1 Extension Popup'ı Açın

Extension icon'una tıklayın (sağ üst köşe)

**SORU 3:** Popup'ta ne görüyorsunuz?

✅ Olması gereken:
```
Connection Status: Connected
⚠️ Not calibrated - Please calibrate first!
[Start Calibration] butonu aktif
```

❌ "Disconnected" diyor:
- Companion app çalışıyor mu?
- WebSocket portu doğru mu? (8765)

### 3.2 Kalibrasyon Başlatın

"Start Calibration" butonuna basın

**SORU 4:** Ne oluyor?

✅ Olması gereken:
- Fullscreen pencere açılır (siyah ekran)
- "Press SPACE to start" mesajı
- SPACE tuşuna basınca 9 nokta gösterir
- Her noktaya bakıp gaze toplanır
- Tamamlanınca pencere kapanır

❌ Hiçbir şey olmuyor:
- Companion app log'una bakın, hata var mı?

### 3.3 Kalibrasyon Sonrası

**SORU 5:** Companion app terminalinde ne görüyorsunuz?

✅ Olması gereken:
```
Starting 9-point calibration...
Calibration complete! Model saved: users/default_model.pkl
```

❌ Hata varsa:
```
[Hata mesajını buraya yazın]
```

---

## ADIM 4: Gaze Data Akışı Testi

### 4.1 Model Yüklendi mi?

```bash
# Terminal'de kontrol edin:
ls -lh companion/users/default_model.pkl

# Dosya varsa ve 0'dan büyükse OK
```

### 4.2 Gaze Data Gönderiliyor mu?

Kalibrasyon sonrası companion app terminaline bakın.

**SORU 6:** DEBUG log'ları görüyor musunuz?

✅ Olması gereken (sürekli akan):
```
DEBUG - Gaze: (453, 289)
DEBUG - Gaze: (455, 291)
DEBUG - Gaze: (458, 290)
...
```

❌ Hiçbir şey yazmıyorsa:
- Model yüklenmedi
- VEYA camera açılamadı
- VEYA gaze predict hata veriyor

**Bu durumda şunu deneyin:**
```bash
# Python console'da test:
python
>>> from gaze_streamer import GazeStreamer
>>> gs = GazeStreamer()
>>> gs.initialize_eyetrax()
>>> gs.is_calibrated
True  # Bu True olmalı!
```

---

## ADIM 5: WebSocket Message Testi

### 5.1 Extension Console'u Açın

1. `chrome://extensions/` sayfasında
2. ReaRead extension'ın altında "service worker" linkine tıklayın
3. DevTools açılır

**VEYA:**

1. Herhangi bir web sayfasında F12 basın
2. Console tab'ına git

### 5.2 WebSocket Mesajlarını Dinle

Console'a şunu yazın:

```javascript
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GAZE_DATA') {
    console.log('📍 Gaze:', msg.data.x, msg.data.y);
  }
});
```

**SORU 7:** Console'da gaze mesajları görüyor musunuz?

✅ Olması gereken:
```
📍 Gaze: 453 289
📍 Gaze: 455 291
📍 Gaze: 458 290
...
```

❌ Hiçbir şey yazmıyorsa:
- Extension WebSocket'ten veri almıyor!
- service-worker.js'de hata var olabilir

---

## ADIM 6: Content Script Testi

### 6.1 Web Sayfası Açın

Herhangi bir site: `https://example.com`

### 6.2 Content Script Console

F12 → Console tab

**SORU 8:** Console'da ne görüyorsunuz?

✅ Olması gereken:
```
ReaRead content script loaded
Gaze cursor initialized
```

❌ Hiçbir şey yazmıyorsa:
- Content script yüklenmedi!
- Extension'ı yenileyin

### 6.3 Manuel Cursor Testi

Console'a şunu yazın:

```javascript
// Cursor var mı?
document.getElementById('rearead-gaze-cursor')

// Yoksa oluştur:
if (!document.getElementById('rearead-gaze-cursor')) {
  const cursor = document.createElement('div');
  cursor.id = 'rearead-gaze-cursor';
  cursor.style.cssText = `
    position: fixed;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: rgba(255, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.8);
    pointer-events: none;
    z-index: 999999;
    display: block;
    left: 500px;
    top: 300px;
  `;
  document.body.appendChild(cursor);
  console.log('✓ Cursor created manually');
}
```

**SORU 9:** Kırmızı cursor görüyor musunuz?

✅ Görüyorum → DOM manipulation çalışıyor
❌ Görmüyorum → CSS/DOM problemi

---

## ADIM 7: Gaze Data → Cursor Update Testi

Console'da gaze data ile cursor'u manuel update edin:

```javascript
const cursor = document.getElementById('rearead-gaze-cursor');

// Gaze mesajlarını yakala ve cursor'u güncelle
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GAZE_DATA') {
    console.log('Gaze received:', message.data.x, message.data.y);

    if (cursor) {
      cursor.style.left = message.data.x + 'px';
      cursor.style.top = message.data.y + 'px';
      cursor.style.display = 'block';
      console.log('✓ Cursor updated');
    }
  }
});
```

**SORU 10:** Cursor hareket ediyor mu?

✅ Ediyor → Tüm sistem çalışıyor! Sorun başka yerde.
❌ Etmiyor → Mesajlar gelmiyor

---

## 🐛 SORUN TESPİT TABLOSU

| Adım | Sonuç | Sorun Nerede? | Çözüm |
|------|-------|---------------|-------|
| 1 | ❌ Companion app başlamıyor | Python/dependencies | `pip install -r requirements.txt` |
| 2 | ❌ Extension bağlanmıyor | WebSocket connection | Port kontrolü, firewall |
| 3 | ❌ Kalibrasyon başlamıyor | Extension → Companion iletişim | Log'ları kontrol et |
| 4 | ❌ Model kaydedilmiyor | Calibration süreci | users/ klasörü yazılabilir mi? |
| 5 | ❌ Gaze data üretilmiyor | EyeTrax/camera | Camera ID doğru mu? (0 veya 1) |
| 6 | ❌ WebSocket mesajı yok | Companion → Extension | WebSocket broadcast çalışıyor mu? |
| 7 | ❌ Extension mesaj almıyor | Extension message handler | service-worker.js debug |
| 8 | ❌ Content script yok | Extension injection | Manifest content_scripts doğru mu? |
| 9 | ❌ Cursor DOM'da yok | Content script initialization | Sayfa yenilenince oluşuyor mu? |
| 10 | ❌ Cursor update olmuyor | Message routing | Extension → Content script iletişim |

---

## 📝 SONUÇLARINIZI BURAYA YAZIN

Lütfen her adımın sonucunu yazın:

```
ADIM 1: [✅/❌]
ADIM 2: [✅/❌]
ADIM 3: [✅/❌]
ADIM 4: [✅/❌]
ADIM 5: [✅/❌]
ADIM 6: [✅/❌]
ADIM 7: [✅/❌]
ADIM 8: [✅/❌]
ADIM 9: [✅/❌]
ADIM 10: [✅/❌]

Hangi adımda takıldınız?
Ne hata mesajı aldınız?
```

---

## 🆘 HIZLI ÇÖZÜM - TÜM SİSTEMİ SIFIRLA

Eğer hiçbir şey çalışmıyorsa:

```bash
# 1. Companion app kapat (Ctrl+C)

# 2. Her şeyi temizle
cd companion
rm -f users/*.pkl
rm -f *.log

# 3. Extension'ı kaldır
# Chrome: chrome://extensions/ → Remove

# 4. Extension'ı tekrar yükle
# Chrome: Load unpacked → extension/ klasörü

# 5. Companion app başlat
python main.py

# 6. Extension popup aç → Calibrate
```

Bu da çalışmazsa sonuçları paylaşın, birlikte bakalım!
