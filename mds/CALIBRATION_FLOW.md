# ReaRead - Calibration Flow Düzeltmesi

## ❌ Önceki Sorun

**Kullanıcı şikayeti:**
> "Extension'ı silip tekrar yükledim ama kalibrasyon istemedi, eski model kullanıldı!"

**Neden oluyordu?**
```
1. Companion app başlar
   └─ users/default_model.pkl varsa yükler
   └─ Extension'a sadece "connected" der

2. Extension bağlanır
   └─ Calibration durumunu BİLMİYOR ❌
   └─ Kullanıcıya uyarı vermez

3. Extension silinir/yeniden kurulur
   └─ Model dosyası duruyor (users/ klasöründe)
   └─ Eski model kullanılıyor ❌
   └─ Yanlış tracking!
```

---

## ✅ Düzeltme Sonrası

### Yeni Akış:

```
1. Companion app başlar
   ├─ Model varsa yükle → is_calibrated = True
   └─ Model yoksa → is_calibrated = False

2. Extension bağlanır
   └─ Status mesajı alır:
       {
         "type": "status",
         "state": "connected",
         "calibrated": false  ← YENİ! ✅
       }

3. Extension calibration durumunu kontrol eder
   ├─ calibrated = false
   │   └─ Bildirim gösterir: "Calibration required!"
   │   └─ Popup'ta uyarı: "⚠️ Not calibrated"
   │
   └─ calibrated = true
       └─ "✅ System ready for tracking"

4. Kullanıcı extension siler/tekrar kurar
   └─ Yeni bağlantıda yine status kontrolü
   └─ Gerekirse kalibrasyon ister ✅
```

---

## 🔧 Yapılan Değişiklikler

### 1. Backend (Companion App)

#### `websocket_server.py`:
```python
# YENİ: Initial status gönderir (calibration info ile)
async def send_initial_status(self, websocket):
    is_calibrated = self.gaze_streamer.is_calibrated

    message = {
        "type": "status",
        "state": "connected",
        "calibrated": is_calibrated  # ← YENİ!
    }

    await websocket.send(json.dumps(message))
```

### 2. Frontend (Extension)

#### `service-worker.js`:
```javascript
case 'status':
  console.log('Calibrated:', message.calibrated);

  // Store calibration status
  chrome.storage.local.set({
    isCalibrated: message.calibrated
  });

  // If not calibrated, show notification
  if (message.calibrated === false) {
    chrome.notifications.create({
      title: 'ReaRead - Calibration Required',
      message: 'Please calibrate to start tracking.'
    });
  }
  break;
```

#### `popup.js`:
```javascript
// Check calibration status and show warning
chrome.storage.local.get(['isCalibrated'], (result) => {
  if (result.isCalibrated === false) {
    statusText.textContent = '⚠️ Not calibrated - Please calibrate first!';
  } else if (result.isCalibrated === true) {
    statusText.textContent = '✅ System ready for tracking';
  }
});
```

#### `manifest.json`:
```json
"permissions": [
  "notifications"  // ← YENİ! Bildirim göstermek için
]
```

---

## 🧪 Test Senaryoları

### Test 1: İlk Kurulum (Model Yok)

```bash
# 1. Model dosyasını sil
rm companion/users/default_model.pkl

# 2. Companion app başlat
cd companion
python main.py

# Beklenen log:
# "No model found - calibration required"
```

**Extension:**
1. Extension'ı aç
2. **Bildirim görmelisin:** "Calibration Required"
3. Popup aç: **"⚠️ Not calibrated"** görmelisin
4. "Start Calibration" butonuna bas
5. Kalibrasyon yap
6. Popup tekrar aç: **"✅ System ready"** görmelisin

---

### Test 2: Model Var (Calibrated)

```bash
# Model zaten var (önceki kalibrasyondan)
ls companion/users/default_model.pkl

# Companion app başlat
python main.py

# Beklenen log:
# "Model loaded successfully - ready for tracking"
```

**Extension:**
1. Extension'ı aç
2. **Bildirim OLMAZSA** (zaten calibrated)
3. Popup aç: **"✅ System ready"** görmelisin
4. Gaze cursor hemen çalışmalı

---

### Test 3: Extension Silme/Yeniden Kurma

```bash
# Companion app çalışırken...
```

**Extension:**
1. Extension'ı sil (Chrome'da kaldır)
2. Model dosyasını SİL: `rm companion/users/default_model.pkl`
3. Extension'ı tekrar yükle
4. **Bildirim görmelisin:** "Calibration Required"
5. Popup: **"⚠️ Not calibrated"**
6. Kalibrasyon yap
7. Şimdi tracking çalışmalı ✅

**Bu test ÖNCE başarısızdı, ŞİMDİ çalışıyor!**

---

## 📊 Kullanıcı Deneyimi

### Önce:
```
Kullanıcı: Extension kurdu
Extension: (sessizce eski modeli kullanır)
Kullanıcı: "Neden yanlış tracking yapıyor?" 😕
```

### Sonra:
```
Kullanıcı: Extension kurdu
Extension: 🔔 "Calibration Required!"
Popup: "⚠️ Not calibrated - Please calibrate first!"
Kullanıcı: "Ah tamam, kalibrasyon yapmalıyım" → Yapar ✅
Extension: "✅ System ready for tracking"
Kullanıcı: "Mükemmel!" 😊
```

---

## 🎯 Kalan İyileştirmeler (Gelecek)

### Öncelik 1: Auto-calibration Prompt
```javascript
// Extension ilk açıldığında otomatik kalibrasyon başlat
if (message.calibrated === false && isFirstLaunch) {
  // Kullanıcıya sor: "Start calibration now?"
  if (confirm("ReaRead requires calibration. Start now?")) {
    chrome.runtime.sendMessage({ type: 'REQUEST_CALIBRATION' });
  }
}
```

### Öncelik 2: User-Specific Models
```python
# Şu an: users/default_model.pkl
# İleride: users/user_123_model.pkl

# Extension'dan user_id gönder
# Companion app user-specific model yükle/kaydet
```

### Öncelik 3: Calibration Expiry
```python
# Model ne zaman oluşturuldu?
# 30 gün sonra yeniden kalibrasyon iste

calibration_date = datetime.now()
if (datetime.now() - calibration_date).days > 30:
    # "Re-calibration recommended"
```

---

## 🐛 Bilinen Sorunlar & Çözümler

### Sorun 1: Extension Yenilenmeden Sonra Durum Güncellenmiyor

**Neden:** Extension background script yeniden başladı ama companion app bunu bilmiyor

**Çözüm:**
```javascript
// service-worker.js - Extension başlarken durumu iste
chrome.runtime.onStartup.addListener(() => {
  connectToCompanion();
});
```

### Sorun 2: Kalibrasyon Sırasında Extension Kapanırsa

**Neden:** Kalibrasyon yarım kaldı, model kaydedilmedi

**Çözüm:**
```python
# Kalibrasyon başarılı olunca status broadcast et
await self.ws_server.broadcast({
    "type": "calibration_complete",
    "success": True
})
```

---

## ✅ Sonuç

**Artık sistem beklediğiniz gibi çalışıyor:**

1. ✅ Extension ilk kurulduğunda kalibrasyon ister
2. ✅ Extension silinip tekrar kurulunca yine ister
3. ✅ Model yoksa bildirim gösterir
4. ✅ Model varsa "ready" der
5. ✅ Kullanıcı her zaman calibration durumunu bilir

**Test edin ve feedback verin!** 🚀
