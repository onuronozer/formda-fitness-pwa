# Phase 3B.2 Release Gate

Durum tarihi: 24 Ağustos 2026.

| Gate | Durum | Kanıt / kalan işlem |
| --- | --- | --- |
| App Check client | Hazır | Production-only `ReCaptchaEnterpriseProvider`, auto refresh, emulator bypass |
| App Check production registration | Açık | Console registration doğrulanmadı; fake key eklenmedi |
| App Check monitoring | Açık | `VITE_FIREBASE_APPCHECK_STATUS=not_configured` |
| Firestore App Check enforcement | Açık | Monitoring metrikleri sonrası console'dan açılmalı |
| Firestore owner/entity rules | Hazır | Emulator owner matrix + nutrition allowlist/unknown entity testi |
| CI WIF | Workflow hazır | GCP provider/service account repository variables henüz tanımlı değil |
| CI JSON fallback | Aktif | Dar rol ve 90 günlük rotation runbook'u mevcut |
| Private beta lifecycle | Hazır | Create, verify, sync, logout, fresh restore, cloud delete, account delete ve local wipe integration testi |
| Clinical release | Bekliyor | `CLINICAL_REVIEW_PENDING`; reviewer veya onay uydurulmadı |

Bu tablo App Check console enforcement veya klinik onay yerine geçmez.
