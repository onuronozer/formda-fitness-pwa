# Firebase Production Runbook

## Projects and environments

Development ve production için ayrı Firebase project kullanılır. `.env.development.example` yalnız emulator içindir; production değerleri CI repository variables içinde saklanır.

Cloud-enabled production deploy için:

```text
FIREBASE_DEPLOY_MODE=enabled
VITE_FIREBASE_ENVIRONMENT=production
VITE_FIREBASE_PROJECT_ID=<production-project-id>
VITE_FIREBASE_EXPECTED_PROJECT_ID=<same-production-project-id>
```

Tüm Firebase Web config alanları gereklidir. Project ID guard eşleşmezse deploy durur. Cloud'suz kontrollü build yalnız `FIREBASE_DEPLOY_MODE=disabled` ve `VITE_FIREBASE_ENVIRONMENT=disabled` ile üretilebilir.

## Authentication

Her iki project'te Email/Password provider açılır. Email enumeration protection etkinleştirilir. Production authorized domains listesi yalnız gerçek hostları içermelidir:

- GitHub Pages için repository path'i değil host eklenir: `<github-owner>.github.io`
- Custom domain kullanıldığında yalnız domain eklenir; kaynak kodda hard-code edilmez
- `localhost` yalnız development project'e gerektiğinde eklenir; production listesinde tutulmaz

## App Check

Client integration `ReCaptchaEnterpriseProvider` ile production-only başlatılır ve site key `VITE_FIREBASE_APPCHECK_SITE_KEY` üzerinden gelir. Site secret frontend'e konmaz.

`VITE_FIREBASE_APPCHECK_STATUS` release durumu için `not_configured`, `monitoring` veya `enforced` değerlerinden birini alır. `monitoring` ve `enforced`, site key yoksa environment guard tarafından reddedilir. Bu değer console ayarını kendiliğinden değiştirmez; repository'nin doğrulanmış rollout beyanıdır.

Enforcement rollout:

1. Production web app'i App Check'e reCAPTCHA Enterprise ile kaydet.
2. Gerçek GitHub Pages/custom hostu reCAPTCHA approved sites listesine ekle.
3. Token metrics'i monitor modunda gözle.
4. Önce Cloud Firestore enforcement'ı aç.
5. Firebase Authentication App Check enforcement için Identity Platform gereksinimini ve maliyeti ayrıca onayla.

App Check site key yokken client integration başlatılmaz. Development/emulator build App Check tarafından engellenmez. Gerekirse debug token yalnız geliştiricinin geçici local browser oturumunda kullanılır; source code, `.env` örneği, GitHub variable veya CI loguna yazılmaz.

24 Ağustos 2026 release gate durumu: production site registration doğrulanmadı, `VITE_FIREBASE_APPCHECK_STATUS=not_configured`, monitoring yok ve Firestore enforcement kapalı kabul edilir. Console işlemleri tamamlanmadan bu kayıt `monitoring` veya `enforced` olarak değiştirilmemelidir.

## CI and deploy

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:firebase
npm run validate:firebase-env
npm run build
firebase deploy --only firestore --project <production-project-id>
```

Rules emulator testi `demo-formda-fitness` kimliğini kullanır ve production Firebase'e bağlanmaz. CI Temurin JDK 21 kurar.

### GitHub Actions credential

Workflow önce keyless Workload Identity Federation kullanır. Aşağıdaki repository variables birlikte tanımlıysa `google-github-actions/auth@v3` GitHub OIDC token'ını kısa ömürlü Google credential'a çevirir:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
GCP_DEPLOY_SERVICE_ACCOUNT=formda-firestore-deploy@<project>.iam.gserviceaccount.com
```

Provider attribute condition'ı repository owner/repository/branch ile sınırlandırılmalıdır. GitHub principal'a deploy service account üzerinde yalnız `roles/iam.workloadIdentityUser` verilir. Deploy hesabına geniş `Owner` veya `Editor` verilmez; Firestore rules/index deploy için ayrı hesapta `roles/firebaserules.admin`, `roles/datastore.indexAdmin` ve gerektiğinde `roles/serviceusage.serviceUsageConsumer` kullanılır. İlk deploy Cloud Audit Logs/IAM deny çıktısıyla doğrulanıp gereksiz rol kaldırılır.

WIF variables yoksa workflow geçici olarak `FIREBASE_SERVICE_ACCOUNT_JSON` secret fallback'ini kullanır. Anahtar frontend'e/Vite env'e girmez ve runner dışında kalıcı dosyaya yazılmaz. Fallback rotation prosedürü:

1. Aynı dar yetkili deploy hesabında yeni key oluştur.
2. GitHub secret'ı yeni JSON ile atomik olarak değiştir.
3. Manuel workflow çalıştırıp rules/index deploy ve Pages deploy sonucunu doğrula.
4. Önceki key'i devre dışı bırak, bir sonraki başarılı çalışmadan sonra sil.
5. En geç 90 günde bir ve her şüpheli sızıntıda hemen döndür; Audit Logs'u kontrol et.

Hedef durum WIF'tir. Mevcut production repository'de WIF variables henüz bulunmadığından fallback aktiftir.

## Hosting headers

GitHub Pages custom response header yönetimi sunmadığı için tam HTTP CSP/HSTS policy repository içinden zorlanamaz. Inline script kullanılmaz; Vite hashed assets üretir. Header-level CSP/HSTS zorunlu hale gelirse custom-header destekleyen Firebase Hosting, Cloudflare veya eşdeğer bir hosting katmanına geçilmelidir. Meta CSP, dinamik Firebase/Auth/App Check endpoint listesi netleşmeden eklenmemelidir.
