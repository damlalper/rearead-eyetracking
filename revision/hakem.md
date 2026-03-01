# 🔴 KARAR: Major Revision  
## Editör Yorumu (Çeviri)

Bu hakem karar mektubunun tamamını dikkatlice okuyun ve revize edilmiş makalenin değerlendirme sürecinde gecikme yaşanmaması için tüm aksiyonları ciddiyetle yerine getirin. Sisteme **“Detailed Response to Reviewers” (Hakemlere Ayrıntılı Yanıt)** yüklemeniz gerekmektedir.

---

## 📌 Açıklama

Editör özellikle şunu söylüyor:  
**Revizyonu hafife almayın. Her yoruma madde madde cevap yazmanız gerekiyor.**

### 🎯 Aslında ne istiyor?

→ Ciddi ve detaylı bir revizyon + hakemlere tek tek cevap dokümanı.

---

# 👩‍⚖️ REVIEWER 1

## 1. Genel Değerlendirme (Çeviri)

Çalışma, okuyucu tercihlerini analiz edebilen düşük maliyetli, webcam tabanlı bir göz izleme sistemi tasarımını sunmaktadır. Sistem genişletilebilir bir yapıya sahip olup farklı analiz çerçevelerine entegre edilebilir.

Çalışmada iris takibi için MediaPipe kullanılmıştır. Mikro hareketlerden kaynaklı gürültüyü azaltmak için Kernel Density Estimation (KDE) tabanlı yumuşatma uygulanmıştır. Göz koordinatları web uygulama katmanlarına aktarılmış ve tatmin edici performans elde edilmiştir.

Yazım açısından makale iyi yapılandırılmış ve literatür yeterlidir. Ancak aşağıdaki noktalar açıklama veya revizyon gerektirmektedir.

---

## 🔹 Soru 1: Head Movement

### Çeviri

Sistem 20 saniyelik bir kalibrasyonla çalışıyor. Kalibrasyondan sonra kullanıcı başını sabit tutmak zorunda mı? Yoksa baş hareketine tolerans var mı? Özellikle kullanıcı ekran merkezinden yana kayarsa sistem nasıl performans gösteriyor? Modelin baş hareketine karşı dayanıklılığı açıklanmalı ve mümkünse nicel olarak değerlendirilmelidir.

### Açıklama

Hakem şunu sorguluyor:

- Kalibrasyon sonrası sistem head movement’e dayanıklı mı?
- Kullanıcı sola sağa kayarsa accuracy düşüyor mu?
- Bunun ölçümü yapılmış mı?

Şu an makalede sadece “normalize ettik” diyorsunuz ama robustness testi yok.

### 🎯 Aslında ne istiyor?

→ Head movement robustness analizi + mümkünse nicel performans ölçümü.

---

## 🔹 Soru 2: KDE Açıklaması

### Çeviri

KDE’nin zamansal gaze noktalarına uygulandığı anlaşılıyor. Bu daha açık anlatılmalı. Figure 4 güncellenmeli. Ayrıca KDE’nin basit ortalama (centroid) almaya göre ölçülebilir bir avantajı var mı? Eğer basit ortalama benzer performans veriyor ve işlem süresini azaltıyorsa daha verimli olabilir.

Ayrıca KDE göz merkezini stabilize ediyor gibi görünüyor. Ancak bu dikkat dağınıklığı olan bireylerde dikkat kararsızlığını maskeleyebilir mi? Tanısal açıdan önemli varyasyonu bastırıyor olabilir mi? Bu konu discussion’da ele alınmalı.

### Açıklama

Hakem iki şey istiyor:

- KDE vs Mean karşılaştırması (ablation study)
- KDE’nin olası dezavantajı (attention instability masking)

### 🎯 Aslında ne istiyor?

→ KDE ablation analizi + discussion’da potansiyel sınırlama eklenmesi.

---

## 🔹 Yazım Hataları

- Efficient küçük harf olmalı  
- Çift “in” hatası  
- CSS tanımlanmamış  
- “The Dwell…” cümlesi hatalı olabilir  
- “This figure 9…” hata olabilir  
- Fontlar büyütülmeli  
- Figure 3 kalite artırılmalı  
- “Distirbution” → Distribution  

### 🎯 Aslında ne istiyor?

→ Profesyonel proofreading + görsel kalite düzeltme.

---

# 👨‍⚖️ REVIEWER 2

Reviewer 2 çok daha ağır eleştirmiş.

---

## 🔴 1) Ethics & Privacy Eksik

### Çeviri

Webcam tabanlı göz takibi biyometrik ve hassas veri içerebilir. Makalede etik kurul gerekmez denmiş ama bu yeterli değil.

Eksik: doğrulanabilir etik, onam ve veri yönetimi açıklaması.

### Eklenmesi gerekenler:

- Açık rıza alındı mı?
- Ham video kaydedildi mi?
- Anonimleştirme yapıldı mı?
- Veri nerede saklanıyor?
- Şifreleme var mı?
- LLM/TTS kullanılıyorsa veri cihazdan çıkıyor mu?

### Açıklama

Bu ciddi bir eleştiri. Human-subject çalışması yapıyorsunuz ama ethics justification zayıf.

### 🎯 Aslında ne istiyor?

→ Ethics & Privacy bölümü ekleyin, veri yönetimini netleştirin.

---

## 🔴 2) Veri Toplama Protokolü Belirsiz

Eksikler:

- Kaç kişi?
- Yaş aralığı?
- Kaç session?
- Hangi cihaz?
- Mesafe?
- Işık?
- Recalibration var mı?

### 🎯 Aslında ne istiyor?

→ Deney protokolü tablosu ekleyin.

---

## 🔴 3) Baseline & Ablation Eksik

- Webcam tabanlı bir baseline ile karşılaştırma yok
- KDE on/off yok
- 5 vs 9 point calibration yok
- Single vs double threshold yok

### 🎯 Aslında ne istiyor?

→ Ablation çalışması + baseline karşılaştırması.

---

## 🔴 4) Metric Tanımı Belirsiz

- Focus score formülü yok
- Difficulty ratio açık formül yok
- Mean±std var ama dağılım analizi yetersiz
- Ground-truth validation yok

### 🎯 Aslında ne istiyor?

→ Matematiksel tanımlar + örnek hesaplama + validity güçlendirme.

---

## 🔴 5) LLM/TTS Belirsiz

- Hangi model?
- Local mi cloud mu?
- Veri dışarı gidiyor mu?
- Prompt ne?
- Logging var mı?

### 🎯 Aslında ne istiyor?

→ AI bileşenleri teknik ve güvenlik detayları.

---

## 🔴 6) Real-Time İddiası Yetersiz

- End-to-end latency dağılımı yok (p50, p90)
- Test donanımı belirtilmemiş
- CPU kullanımı yok

### 🎯 Aslında ne istiyor?

→ Gerçek sistem benchmark verisi.

---

# 📌 GENEL DURUM ANALİZİ

- Reviewer 1 → Teknik iyileştirme ve netleştirme istiyor.  
- Reviewer 2 → Makaleyi metodolojik olarak zayıf bulmuş.  