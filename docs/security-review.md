# Phase 3B.1 Security Review

## Trust boundaries

- Dexie uygulamanın local source-of-truth katmanıdır.
- Firebase browser config public project tanımlayıcısıdır; privileged credential değildir.
- Firestore her request'te Auth UID/path UID/envelope owner eşitliğini doğrular.
- Create/update yalnız `email_verified=true` token ile mümkündür.
- Unknown Firestore paths default-deny'dır.
- Static seed data cloud user documents içine yazılmaz.

## Account isolation

- Domain UUID ile Firebase Auth UID ayrı tutulur.
- Bir Auth UID yalnız bir local workspace'e unique index ile bağlanır.
- Logout cloud UID eşlemesini silmez; pending outbox aynı workspace'e bağlı kalır.
- Logout sonrası authenticated workspace pasifleşir; farklı hesap eski local sağlık verisini göremez.
- Fresh bootstrap cloud dataset içinde birden fazla `localUserId` veya forged owner görürse işlemi durdurur.

## Conflict safety

- Append event'lerde ayrı ID'ler birlikte korunur.
- Versioned data önce `version`, sonra `updatedAt` ile çözülür.
- Aynı version/timestamp farklı content için canonical deterministic tie-break uygulanır ve audit yazılır.
- Tombstone otomatik olarak live update ile yeniden canlandırılmaz.
- Retry exponential backoff üst sınırı 15 dakikadır; manuel retry vardır.

## Logging and secrets

- Production error handler console'a payload yazmaz.
- Development logu yalnız context, error name ve kısa code içerir.
- Email, ölçüm, tansiyon, semptom ve condition payload'ları loglanmaz.
- Backup Auth token, UID/e-posta cloud bağlantısı, service account veya private key içermez.

## Residual boundaries

- Client-side encryption at rest yoktur; browser/platform storage ve Firebase kontrolleri kullanılır.
- GitHub Pages custom security header ekleyemez.
- App Check client entegrasyonu hazırdır; enforcement production telemetry sonrası console'dan açılmalıdır.
- `CLINICAL_REVIEW_PENDING` değişmemiştir ve public clinical release onayı değildir.
