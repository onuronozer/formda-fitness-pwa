# Formda

Formda, mobil-first ve local-first bir fitness/sağlık takip PWA'sıdır. Phase 3B.1, mevcut Firebase sync'i production environment ayrımı, tam Auth yaşam döngüsü, local workspace izolasyonu, gerçek Rules/Auth emulator testleri ve account deletion recovery akışıyla sıkılaştırır.

Uygulama tanı koymaz, hastalık tedavi etmez ve bir hareketin kesin güvenli olduğunu iddia etmez. Klinik release durumu `CLINICAL_REVIEW_PENDING` olarak kalır; insan reviewer veya release onayı atanmış değildir.

## Stack

- React 19, TypeScript, Vite ve React Router
- IndexedDB / Dexie.js ana local application database
- Firebase Authentication ve Cloud Firestore opsiyonel remote sync hedefi
- Zod, Zustand, date-fns ve Lucide
- vite-plugin-pwa / Workbox
- Vitest, Testing Library ve fake-indexeddb

## Local-first mimari

```text
User action
   |
Dexie transaction + outbox event
   |
UI immediately reflects local data
   |
SyncService -> ConflictResolver -> FirebaseAdapter
   |
Cloud Firestore authenticated copy
```

React bileşenleri Firestore'u doğrudan çağırmaz. Repository ve service katmanları yerel yazmayı ve outbox event'ini aynı transaction içinde tamamlar. `SyncCoordinator` yalnız cloud sync açıkken ve uygulama online olduğunda lazy yüklenir. İlk cloud bağlantısında idempotent snapshot taraması mevcut yerel verileri kuyruğa alır; sonraki yazmalar doğrudan outbox üretir.

Firestore kalıcı offline cache'i açılmaz. Dexie tek yerel doğruluk kaynağıdır; Firestore memory cache ile uzak sync hedefi olarak çalışır. Cloud veya internet hatası yerel write'ı geri almaz.

## Firebase kurulumu

1. Firebase projesinde bir Web App oluştur.
2. Authentication içinde Email/Password provider'ını aç ve mümkünse email enumeration protection'ı etkinleştir.
3. Cloud Firestore oluştur; [firestore.rules](./firestore.rules) ve [firestore.indexes.json](./firestore.indexes.json) dosyalarını deploy et.
4. Development emulator için [.env.development.example](./.env.development.example), production için [.env.production.example](./.env.production.example) alanlarını kullan.
5. GitHub Pages hostunu (`<github-owner>.github.io`) production Firebase Auth authorized domains listesine al. Repository path'i domain değildir; custom domain source code'a hard-code edilmez.

```bash
firebase deploy --only firestore
```

Firebase Web config benzersiz ama privileged olmayan proje/app tanımlayıcılarıdır. Service account, Admin SDK credential, private key veya server secret frontend'e konmaz. Veri güvenliği Authentication ve Firestore Security Rules ile sağlanır. Config yoksa uygulama local-only çalışmaya devam eder ve Firebase SDK başlatılmaz.

## Authentication ve hesap politikası

Ayarlar ve `/auth` ekranı e-posta/parola ile hesap oluşturma, parola teyidi, giriş, nötr password reset, doğrulama e-postası, resend, refresh, sign-out, cloud aç/kapat ve hesap silmeyi destekler. Hesapsız kullanım Firebase anonymous account oluşturmadan local-only devam eder.

Cloud upload yalnız doğrulanmış e-posta ile başlar. `Cloud verilerimi sil` uzak kayıtları batch olarak siler ve sync'i kapatır; Auth hesabı kalır. `Hesabımı sil` önce cloud kayıtlarını, sonra Firebase Auth hesabını siler; recent-login veya partial failure kullanıcıya recovery state olarak gösterilir. Yerel veri yalnız ayrıca seçilirse silinir.

Merkezi `AuthService` loading/authenticated/unauthenticated/email-unverified/error/unavailable durumlarını yönetir. Firebase SDK kendi token persistence mekanizmasını kullanır; access/refresh token domain modeline veya backup'a yazılmaz.

## Sync kapsamı ve conflict policy

Cloud'a yalnız user-generated kayıtlar gider:

- Profil, sağlık profili, condition cevapları ve health evaluation logları
- Kilo, bel ve adım kayıtları
- DailyHealthCheck, PreWorkoutCheck ve yanıtları
- Workout plan/day/exercise, session ve set kayıtları
- WaterRecord, hydration target, daily goal settings/plan ve cardio session

Static exercise/evidence/media/interval seed tabloları kullanıcı dokümanı olarak cloud'a kopyalanmaz.

Event tarzı kayıtlar ID bazlı merge edilir. Profile/settings ve program yapıları `version` ardından `updatedAt` ile çözülür. Aynı version/timestamp fakat farklı content canonical deterministic tie-break ile çözülür ve `syncConflictAudits` kaydı bırakır. Tombstone otomatik live update ile yeniden canlandırılmaz. Aynı entity/version/operation outbox anahtarı idempotenttir.

Firestore yolu `users/{uid}/records/{entityType__entityId}` biçimindedir. Envelope üst seviyesindeki `userId` Firebase UID'sidir; Rules create/read/update/delete için hem path UID hem document owner UID kontrolü yapar. Varsayılan kural tüm diğer yolları reddeder.

## Sağlık verisi ve gizlilik

Kilo, bel, sağlık profili, semptom kontrolleri, workout, su ve adım verileri hassas kabul edilir. Cloud Sync opt-in'dir. Gerçek sağlık payload'ları console'a yazılmaz. JSON backup aynı hassas verileri taşıyabilir ve güvenli bir yerde saklanmalıdır.

Ayrıntılı threat boundary ve veri yaşam döngüsü [PRIVACY.md](./PRIVACY.md) içindedir.

## Su takibi

Today ekranında `+200`, `+250`, `+330`, `+500` ml quick-add, özel miktar, günlük toplam, progress, geçmiş, edit ve soft-delete vardır. Tek kayıt 50-3000 ml aralığında Zod ile doğrulanır.

V1 günlük hedefi kullanıcı tarafından değiştirilebilen 2400 ml `PROGRAM_RULE` tercihidir; medikal reçete değildir. `fluid_restriction` altyapısı otomatik hedefi kapatabilir fakat uygulama yeni bir hastalık veya kısıt tanısı üretmez.

## iPhone Su Kestirmesi

Deep-link formatı:

```text
https://<host>/<base>/?action=water&ml=250
```

Yalnız `action=water` ve doğrulanan miktar kabul edilir. Her navigation için history state içinde action ID oluşturulur; `ShortcutActionReceipt` ve WaterRecord aynı transaction içinde yazılır. Başarılı işlemden sonra query param temizlenir. İşlem sırasında refresh olursa aynı action ID ikinci kaydı engeller.

Ayarlar 200/250/330/500 ml preset linklerini üretir. iOS Kestirmeler içinde `URL Aç` aksiyonuna bu linklerden biri verilebilir. PWA açılmadan direkt cloud write yapan public endpoint **uygulanmamıştır**.

Gelecekteki server-side contract taslağı:

```http
POST /water-ingest
Authorization: <short-lived authenticated credential>

{
  "amountMl": 250,
  "timestamp": "ISO-8601",
  "idempotencyKey": "unique-per-action"
}
```

Bu contract güvenli server-side auth tamamlanmadan yayınlanmamalıdır; Shortcut içine password, Admin credential veya kalıcı secret konamaz.

## DailyGoalEngine ve adaptif adım

`DailyGoalEngine` deterministiktir. Son yedi gündeki adım gözlemlerini, minimum veri gününü, mevcut baseline'ı, manual/adaptive modu, health status'u ve workout gününü kullanarak `DailyGoalPlan` snapshot'ı üretir.

- En az 4 veri günü yoksa adaptasyon yapılmaz.
- Progression/regression miktarları merkezi `PROGRAM_RULE` config'idir.
- `MODIFIED` durumda progression yapılmaz.
- `MEDICAL_REVIEW_REQUIRED` ve `RED_FLAG_BLOCKED` yeni agresif progression almaz.
- Manual hedef kullanıcı kontrolünü korur.
- Geçmiş plan snapshot'ları yeniden hesaplanmaz.
- Bugünkü plan değişen health/workout girdileriyle yenilenebilir; hydration target gün içinde sabit kalır.

## Interval

V1 static seed, 28 dakikalık `Yürüyüş Interval 1` programıdır: 5 dk ısınma, 1 dk tempolu + 2 dk rahat x6, 5 dk soğuma. Bu bir `PROGRAM_RULE` tercihidir.

Timer foreground'da `warmup`, `work`, `recovery`, `cooldown`, `complete` fazlarını deterministik elapsed-time hesabıyla yürütür. `CardioSession` start, complete/early stop, tur ve 1-5 zorluk feedback'i saklar. `NORMAL` uygundur; bu protokol `MODIFIED` için kapalıdır. Medical review ve red flag her zaman bloklanır.

## Dexie v6 ve backup v5

Dexie v6, Phase 3B tablolarına şu hardening tablolarını ekler:

- `localWorkspaces`: local domain user ID ile opsiyonel Auth UID eşlemesi
- `syncConflictAudits`: payload içermeyen conflict provenance

Backup formatı v5 olarak kalır. Yalnız aktif workspace'in user-generated domainleri export edilir; outbox, conflict audit, Shortcut receipt, static seed, Auth UID/e-posta ve Firebase token yedeğe girmez. Import cloud bağlantısını otomatik restore etmez. Backup v2, v3 ve v4 importları desteklenir.

## Test ve geliştirme

Node.js 20.19 veya yenisi gerekir.

```bash
npm install
npm run dev
npm test
npm run test:firebase
npm run typecheck
npm run lint
npm run build
```

Firebase testleri production projesine yazmaz. `@firebase/rules-unit-testing` gerçek Firestore Rules emulator üzerinde owner matrix'ini, Auth emulator ise sign-up/verification/reset/delete kontratlarını çalıştırır. `demo-formda-fitness` kimliği non-production'dır. JDK 21 önerilir.

## Bundle ve PWA

Auth, Firestore ve Firebase core ayrı lazy chunk'lardır. Sync coordinator yalnız cloud etkin kullanıcıda yüklenir. Firebase SDK chunk'ları local-only PWA precache listesine alınmaz; uygulama shell'i ve Dexie özellikleri offline kalır. GitHub Pages base path ve SPA fallback workflow'u korunur.

## Production runbook

Environment guard, App Check rollout, CI secret/variable listesi, authorized domain ve hosting header sınırı [docs/firebase-production.md](./docs/firebase-production.md) içinde; veri envanteri [docs/privacy-data-inventory.md](./docs/privacy-data-inventory.md), threat review [docs/security-review.md](./docs/security-review.md) içindedir.

Phase 4'e geçilmemiştir. `CLINICAL_REVIEW_PENDING` public clinical release için yeterli değildir.
