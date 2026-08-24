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

Tüm Firebase Web config alanları gereklidir. Project ID guard eşleşmezse deploy durur. Cloud'suz kontrollü build yalnız `FIREBASE_DEPLOY_MODE=disabled` ve `VITE_FIREBASE_ENVIRONMENT=disabled` ile üretilebilir. Service account JSON yalnız `FIREBASE_SERVICE_ACCOUNT_JSON` GitHub Actions secret'ında tutulur; Vite env veya frontend bundle'a konmaz.

## Authentication

Her iki project'te Email/Password provider açılır. Email enumeration protection etkinleştirilir. Production authorized domains listesi yalnız gerçek hostları içermelidir:

- GitHub Pages için repository path'i değil host eklenir: `<github-owner>.github.io`
- Custom domain kullanıldığında yalnız domain eklenir; kaynak kodda hard-code edilmez
- `localhost` yalnız development project'e gerektiğinde eklenir; production listesinde tutulmaz

## App Check

Client integration `ReCaptchaEnterpriseProvider` ile production-only başlatılır ve site key `VITE_FIREBASE_APPCHECK_SITE_KEY` üzerinden gelir. Site secret frontend'e konmaz.

Enforcement rollout:

1. Production web app'i App Check'e reCAPTCHA Enterprise ile kaydet.
2. Gerçek GitHub Pages/custom hostu reCAPTCHA approved sites listesine ekle.
3. Token metrics'i monitor modunda gözle.
4. Önce Cloud Firestore enforcement'ı aç.
5. Firebase Authentication App Check enforcement için Identity Platform gereksinimini ve maliyeti ayrıca onayla.

App Check site key yokken client integration başlatılmaz. Emulator build App Check tarafından engellenmez. Debug token source code veya CI loguna yazılmaz.

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

## Hosting headers

GitHub Pages custom response header yönetimi sunmadığı için tam HTTP CSP/HSTS policy repository içinden zorlanamaz. Inline script kullanılmaz; Vite hashed assets üretir. Header-level CSP/HSTS zorunlu hale gelirse custom-header destekleyen Firebase Hosting, Cloudflare veya eşdeğer bir hosting katmanına geçilmelidir. Meta CSP, dinamik Firebase/Auth/App Check endpoint listesi netleşmeden eklenmemelidir.
