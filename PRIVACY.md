# Formda Privacy Architecture

## Data classification

Profil, sağlık condition/answer kayıtları, semptom kontrolleri, kilo, bel, adım, workout, cardio ve su kayıtları hassas kullanıcı verisidir. Static curated exercise/evidence/media/interval seed kayıtları kullanıcı verisi değildir.

## Local boundary

Dexie/IndexedDB uygulamanın yerel doğruluk kaynağıdır. Local-only kullanım varsayılan ve tam işlevseldir. Firebase yapılandırması veya hesap bağlantısı yokken kullanıcı verisi ağ üzerinden gönderilmez.

## Cloud boundary

Cloud Sync açık olduğunda user-generated kayıtların authenticated kopyası Cloud Firestore'a gider. Her document envelope'ında Firebase Auth UID sahibi belirtilir. Firestore Rules path UID, authenticated UID ve document owner UID eşitliğini zorunlu tutar; diğer tüm yollar default-deny'dır.

Firebase browser config public client tanımlayıcılarıdır. Service account, Admin SDK credential, private key ve server secret frontend bundle'ına konmaz.

## Logging

Console loglarında gerçek health payload, semptom cevabı, ölçüm veya kullanıcı kaydı bulunmamalıdır. Hatalar yalnız isim/kod ve payload içermeyen teknik mesaj ile kaydedilir.

## Workspace isolation

Local domain `userId` ile Firebase Auth UID ayrı kimliklerdir. `LocalWorkspace` yalnız aktif dataset'i görünür yapar. Logout local veriyi silmez; authenticated workspace'i pasifleştirir ve pending outbox'ı aynı hesap eşlemesinde tutar. Başka hesap login olduğunda önceki workspace otomatik görünmez veya sync edilmez.

## Data lifecycle

- Logout: yerel veri kalır, cloud sync `authentication_required` olur ve workspace pasifleşir.
- Cloud data delete: authenticated Firestore kopyaları silinir; local data ve Auth account kalır.
- Account delete: Firestore temizliğinden sonra Auth account silinir; partial failure success olarak gösterilmez.
- Full local wipe: yalnız kullanıcı ayrıca seçerse user-generated data, outbox, preference, receipt ve conflict audit fiziksel silinir.
- Local delete: soft-delete tombstone outbox ve cloud'a taşınır.
- Backup export: hassas veriyi JSON olarak kullanıcıya verir; güvenli saklama sorumluluğu kullanıcıdadır.
- Backup import: cloud account bağlantısı otomatik etkinleştirilmez.

## Shortcut boundary

Deep-link girdileri Zod ile doğrulanır ve persistent receipt ile replay'e karşı korunur. Public unauthenticated cloud ingest endpoint yoktur. Gelecekteki direct ingest yalnız kısa ömürlü authenticated credential ve server-side idempotency ile açılabilir.

## Inventory

Domain bazlı local/cloud/backup/retention/deletion matrisi [docs/privacy-data-inventory.md](./docs/privacy-data-inventory.md) içindedir.

## Known boundaries

- Firebase project provisioning ve console-side authorized domain/App Check enforcement operasyonel runbook gerektirir.
- Client-side encryption at rest eklenmemiştir; platform/browser storage ve Firebase güvenlik kontrolleri kullanılır.
- App Check reCAPTCHA Enterprise client kapısı uygulanmıştır; enforcement production telemetry sonrası açılır.
