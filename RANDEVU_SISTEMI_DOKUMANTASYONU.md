# ALER KUAFOR — Randevu Sistemi ve Yönetici Onay Mekanizması Teknik Dokümantasyonu (`RANDEVU_SISTEMI_DOKUMANTASYONU.md`)

**Proje:** ALER KUAFOR — Ahmet Aler Kar Premium Erkek Kuaförü Web Uygulaması `(DEMO)`  
**İlgili Kaynak Dosyalar:** `/home/antigravity/index.html`, `/home/antigravity/styles.css`, `/home/antigravity/app.js`  
**Veri Depolama Anahtarı:** `localStorage` → `aler_kuafor_appointments_v1`

---

## 1. Sistem Mimarisi ve Çalışma Prensibi

**ALER KUAFOR Randevu Sistemi (DEMO)**, gerçek bir lüks erkek kuaförü rezervasyon ve yönetici onay iş akışını istemci tarafında (`Vanilla JavaScript` + `localStorage`) eksiksiz olarak simüle etmek üzere tasarlanmıştır. Sistemin en temel iş kuralı şudur:

> **Temel Kural:** Müşteri tarafından gönderilen hiçbir randevu talebi otomatik olarak onaylanmaz. Her yeni talep sistemde **`"Beklemede"`** durumunda oluşturulur ve yalnızca **Ahmet Aler Kar Yönetici Paneli (`#admin-approval-panel`)** üzerinden yapılan açık onay/ret işlemiyle **`"Onaylandı"`** veya **`"Reddedildi"`** durumuna geçer.

### Uçtan Uca Veri ve Etkileşim Akışı

```text
[1. Hizmet Kartı (.service-book-btn) veya Hero Butonu (#hero-book-btn)]
       │  ("Randevu Al (DEMO)" tıklaması -> #serviceSelect otomatik doldurulur)
       ▼
[2. Randevu Talebi Formu (#appointment-form)]
       │  (7 alanın istemci tarafı doğrulaması & TR telefon maskelemesi)
       ▼
[3. Gönderim (#submit-appointment-btn: "Randevu Talebi Gönder (DEMO)")]
       │
       ├──► A) localStorage ('aler_kuafor_appointments_v1') Kaydı Oluşturulur
       │       • status: "Beklemede" (Otomatik onay KAPALI)
       │       • decidedBy: null
       │
       ├──► B) Kullanıcı Onay Mesajı (#appointment-confirmation) Gösterilir:
       │       "Randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)"
       │
       └──► C) Ahmet Aler Kar Yönetici Paneli (#admin-approval-panel) & Bildirim Kuyruğu Güncellenir
                 │
                 ├──► Yönetici [Onayla (DEMO)] Tıklar ──► status = "Onaylandı" + Onay SMS/E-posta Logu
                 └──► Yönetici [Reddet (DEMO)] Tıklar ──► status = "Reddedildi" + Ret SMS/E-posta Logu
```

---

## 2. Form Alanları ve Doğrulama (Validation) Kuralları

Randevu formu (`#appointment-form`), `index.html` içerisinde `#randevu` bölümünde yer alır ve 7 temel alandan oluşur:

| # | Form Alanı | DOM Seçici (`id`) | HTML Tipi | Zorunluluk | Doğrulama (Validation) Kuralı & UX Davranışı | Hata Mesajı (`app.js`) |
|---|---|---|---|---|---|---|
| 1 | **Ad Soyad** | `#fullName` | `input[type="text"]` | Zorunlu (`*`) | Boşluklar temizlendikten sonra (`.trim()`) en az 3 karakter uzunluğunda olmalıdır. | `"Lütfen geçerli bir Ad ve Soyad giriniz (en az 3 karakter)."` |
| 2 | **Telefon** | `#phone` | `input[type="tel"]` | Zorunlu (`*`) | Kullanıcı yazarken `formatTurkishPhone()` fonksiyonu ile otomatik olarak `05XX XXX XX XX` biçimine maskelenir. `05` ile başlayan 11 hane (veya `5` ile başlayan 10 hane / `905` ile başlayan 12 hane) doğrulaması yapılır. | `"Lütfen 05XX XXX XX XX formatında geçerli bir cep telefonu numarası giriniz."` |
| 3 | **E-posta** | `#email` | `input[type="email"]` | Zorunlu (`*`) | `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` düzenli ifadesi (Regex) ile standart e-posta formatı doğrulanır ve küçük harfe normalize edilir. | `"Lütfen bildirimlerin iletileceği geçerli bir e-posta adresi giriniz."` |
| 4 | **Hizmet Seçimi** | `#serviceSelect` | `select` | Zorunlu (`*`) | 6 ana hizmet kodundan (`sac-kesimi`, `sakal-tasarimi`, `sac-boyama`, `cilt-bakimi`, `keratin-bakimi`, `vip-damat-paketi`) biri seçilmelidir. Seçildiğinde `#serviceSelect-helper` alanında süre, konsept ücret ve kullanılan ürün markaları gösterilir. | `"Lütfen randevu almak istediğiniz hizmeti seçiniz."` |
| 5 | **Tercih Edilen Tarih** | `#preferredDate` | `input[type="date"]` | Zorunlu (`*`) | Sayfa yüklendiğinde `min` özniteliği dinamik olarak bugünün ISO tarihine (`YYYY-MM-DD`), `max` ise `+60` güne ayarlanır. Geçmiş tarih seçilemez. | `"Lütfen bugün veya ileri bir randevu tarihi seçiniz."` |
| 6 | **Tercih Edilen Saat** | `#preferredTime` | `select` | Zorunlu (`*`) | Salon çalışma saatleri (`09:30` – `20:15`) arasındaki 12 zaman diliminden biri seçilmelidir. | `"Lütfen tercih ettiğiniz randevu saatini seçiniz."` |
| 7 | **Ek Notlar** | `#notes` | `textarea` | İsteğe Bağlı | Maksimum 300 karakter (`maxlength="300"`). Canlı karakter sayacı (`#notes-counter`) içerir ve XSS saldırılarına karşı render edilirken `escapeHtml()` ile temizlenir. | *(İsteğe bağlı alan — hata üretmez)* |

### Hizmet Kartlarından Tek Tıkla Otomatik Seçim
`#hizmetler` bölümündeki her `.service-card` bileşeninde yer alan `<button class="btn btn-gold btn-full service-book-btn" data-service="...">Randevu Al (DEMO)</button>` butonuna tıklandığında:
1. Butonun `data-service` değeri okunarak `#serviceSelect.value` değerine atanır.
2. `#serviceSelect` üzerinde `change` olayı tetiklenerek hizmetin süresi, fiyatı ve markaları yardımcı satırda gösterilir.
3. Sayfa yumuşak kaydırma (`scrollIntoView({ behavior: 'smooth' })`) ile `#randevu` formuna ilerler ve `#fullName` alanına odaklanır.

---

## 3. Gönderim Sonrası Davranış ve Onay Mesajı

Form doğrulamadan başarıyla geçtiğinde:
1. `#appointment-confirmation` kapsayıcısından `.hidden` sınıfı kaldırılarak onay kutusu görünür hale getirilir (`role="status"` ve `aria-live="polite"`).
2. `#appointment-confirmation-text` içerisinde **kelimesi kelimesine** aşağıdaki zorunlu mesaj gösterilir:
   > **`Randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)`**
3. Hemen altındaki `#appointment-confirmation-meta` alanında oluşturulan randevunun **Referans Numarası (`#ALR-...`)**, müşteri bilgileri, seçilen hizmet, tarih/saat ve **`Beklemede`** durum rozeti gösterilir.

---

## 4. Veri Modeli ve `localStorage` Şeması (`aler_kuafor_appointments_v1`)

Tüm randevu kayıtları tarayıcının `localStorage` alanında `aler_kuafor_appointments_v1` anahtarı altında JSON dizisi olarak tutulur. Tarayıcı kısıtlamalarına karşı `try/catch` ve bellek içi (`memoryFallbackStore`) yedekleme mekanizması mevcuttur.

### Tekil Randevu Kaydı JSON Şeması

```json
{
  "id": "ALR-849201",
  "fullName": "Burak Yılmaz",
  "phone": "0532 418 90 12",
  "email": "burak.yilmaz@ornek.com",
  "serviceCode": "sac-kesimi",
  "serviceLabel": "Saç Kesimi — Kişiye Özel Anatomik Saç Kesimi (45 Dk - 950 ₺ DEMO)",
  "preferredDate": "2026-11-08",
  "preferredTime": "14:30",
  "notes": "Yanlar skin fade geçiş, üstler makasla doğal doku olsun lütfen.",
  "status": "Beklemede",
  "createdAt": "2026-11-07T13:20:00.000Z",
  "updatedAt": "2026-11-07T13:20:00.000Z",
  "decidedBy": null,
  "notificationLog": [
    {
      "timestamp": "2026-11-07T13:20:00.000Z",
      "channel": "SMS (Netgsm REST v2 Simülasyon)",
      "recipient": "0532 418 90 12",
      "event": "TALEP_ALINDI",
      "message": "Sayın Burak Yılmaz, ALER KUAFOR (2026-11-08 14:30) randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)"
    },
    {
      "timestamp": "2026-11-07T13:20:00.000Z",
      "channel": "E-POSTA (EmailJS / SMTP Simülasyon)",
      "recipient": "burak.yilmaz@ornek.com",
      "event": "TALEP_ALINDI",
      "message": "Randevu talebiniz alındı. Ahmet Aler Kar onayladıktan sonra size bilgi verilecektir. (DEMO)"
    }
  ]
}
```

### `app.js` İçerisindeki Temel CRUD Fonksiyonları
- `getAppointments()`: `localStorage.getItem('aler_kuafor_appointments_v1')` verisini okur; eğer depolama boşsa 3 adet gerçekçi başlangıç (seed) randevusu (2 adet `"Beklemede"`, 1 adet `"Onaylandı"`) oluşturur.
- `saveAppointments(list)`: Güncel randevu dizisini JSON olarak `localStorage`'a yazar.
- `createAppointment(formData)`: Yeni randevuyu `status: 'Beklemede'` ve `decidedBy: null` olarak oluşturur, ilk SMS/E-posta bildirim loglarını üretir ve listenin başına ekler.
- `updateAppointmentStatus(appointmentId, newStatus)`: Yönetici panelinden tetiklenen `"Onaylandı"` veya `"Reddedildi"` kararını kaydeder, `decidedBy: 'Ahmet Aler Kar'` atamasını yapar ve müşteriye giden onay/ret bildirim simülasyonunu `notificationLog` dizisine ekler.
- `deleteAppointment(appointmentId)`: İlgili randevu kaydını listeden siler.
- `resetDemoAppointments()`: `"Örnek Verileri Sıfırla (DEMO)"` (`#reset-demo-data-btn`) butonuna basıldığında başlangıç demo kayıtlarını geri yükler.

---

## 5. Ahmet Aler Kar Yönetici Onay Paneli (`#admin-approval-panel`) ve Durum Makinesi

`#yonetici-paneli` bölümünde yer alan `#admin-approval-panel`, Ahmet Aler Kar'ın randevu taleplerini inceleyip onayladığı yönetim ekranını simüle eder:

1. **KPI Sayaçları:**
   - `#stat-total`: Toplam randevu talebi sayısı
   - `#stat-pending`: Onay bekleyen (`Beklemede`) talep sayısı
   - `#stat-approved`: Ahmet Aler Kar tarafından onaylanan (`Onaylandı`) talep sayısı
   - `#stat-rejected`: Reddedilen (`Reddedildi`) talep sayısı
2. **Durum Filtreleri:** `Tümü`, `Beklemede`, `Onaylandı`, `Reddedildi` sekmeleriyle talepler anlık filtrelenir.
3. **Yönetici Aksiyon Butonları:**
   - **`Onayla (DEMO)` (`button[data-action="approve"]`):** Randevunun durumunu `"Beklemede"` → `"Onaylandı"` olarak değiştirir, rozeti yeşil (`.badge-onaylandi`) yapar ve onay SMS/E-posta bildirimini tetikler.
   - **`Reddet (DEMO)` (`button[data-action="reject"]`):** Randevunun durumunu `"Reddedildi"` olarak değiştirir, rozeti kırmızı (`.badge-reddedildi`) yapar ve bilgilendirme SMS/E-posta kaydını tetikler.
   - **`Sil (DEMO)` (`button[data-action="delete"]`):** Kaydı listeden kaldırır.

---

## 6. E-posta ve SMS Bildirim Simülasyonu (ve Prodüksiyon Entegrasyon Mimarisi)

### 6.1. Uygulama İçi Canlı Simülatör (`#notification-log-panel`)
Yönetici panelinin alt kısmında yer alan `#notification-log-panel`, form gönderildiğinde (`TALEP_ALINDI`) ve yönetici onay/ret verdiğinde (`RANDEVU_ONAYLANDI` / `RANDEVU_REDDEDILDI`) üretilen SMS ve E-posta mesajlarını zaman damgası, alıcı bilgisi ve `HTTP 200 OK (DEMO)` durumuyla canlı olarak listeler.

### 6.2. Gerçek Dünya (Prodüksiyon) Entegrasyon Rehberi
Canlıya geçiş aşamasında API anahtarlarının güvenliği için çağrılar bir arka uç (Node.js / Firebase Cloud Functions) katmanından yapılır:
- **SMS Ağ Geçidi (Netgsm REST v2 / İletimerkezi / Twilio):** `POST https://api.netgsm.com.tr/sms/rest/v2/send` uç noktasına `msgheader: "ALERKUAFOR"`, `encoding: "TR"` ve `iysfilter: "0"` (bilgilendirme mesajı) parametreleriyle JSON isteği gönderilir.
- **E-posta Servisi (EmailJS / SendGrid / SMTP):** Müşterinin e-posta adresine randevu durumu ve onaylandığında `.ics` takvim davetiyesi iletilir.
