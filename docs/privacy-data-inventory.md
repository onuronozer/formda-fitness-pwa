# Formda Privacy Data Inventory

Formda local-first çalışır. Firebase Authentication hesabı zorunlu değildir; Cloud Sync ayrıca açılır ve doğrulanmış e-posta gerektirir.

| Veri kategorisi | Yerel (Dexie) | Cloud Sync | Backup v5 | Saklama ve silme |
| --- | --- | --- | --- | --- |
| Profil | Evet | Opt-in | Evet | Workspace silinene, hesap silmede yerel wipe seçilene veya backup import ile değiştirilene kadar |
| Sağlık koşulları | Evet | Opt-in | Evet | Profil ile aynı; cloud data delete yalnız uzak kopyayı siler |
| Semptom ve günlük kontroller | Evet | Opt-in | Evet | Revision ve audit kayıtları kullanıcı açıkça silene kadar |
| Kilo | Evet | Opt-in | Evet | Soft-delete tombstone cloud'a taşınır; full local wipe fiziksel olarak temizler |
| Bel ölçümü | Evet | Opt-in | Evet | Kilo kayıtlarıyla aynı |
| Adım | Evet | Opt-in | Evet | Kilo kayıtlarıyla aynı |
| Su | Evet | Opt-in | Evet | Kayıt ve tombstone policy uygulanır |
| Workout plan/session/set | Evet | Opt-in | Evet | İlişkiler restore sırasıyla korunur |
| Günlük hedef snapshot'ları | Evet | Opt-in | Evet | Tarihsel snapshot restore sonrası yeniden hesaplanmaz |
| Cardio/interval session | Evet | Opt-in | Evet | User-generated session cloud'a gider; static protocol gitmez |
| Shortcut receipt | Evet | Hayır | Hayır | Replay korumasıdır; explicit full local wipe ile temizlenir |
| Sync outbox/conflict audit | Evet | Hayır | Hayır | Workspace'e bağlı teknik kayıt; full local wipe ile temizlenir |
| Firebase Auth token | Firebase SDK persistence | Firebase Auth yönetir | Hayır | Firebase SDK ve hesap yaşam döngüsü yönetir; domain tablolarına yazılmaz |
| Exercise/evidence/media/interval seed | Evet | Hayır | Hayır | Uygulamanın versioned seed sistemi yeniden kurar |

## Ownership

`LocalWorkspace.localUserId` domain kayıtlarını, `LocalWorkspace.authUid` ise opsiyonel Firebase hesabını temsil eder. Cloud yolu Auth UID kullanır; payload içindeki domain `userId` yeniden yazılmaz. Aynı browser'da yalnız `ACTIVE` workspace görünür. Çıkış, önce o workspace'in sync'ini durdurur ve başka hesabın bekleyen outbox kayıtlarını çalıştırmaz.

## Deletion

- **Cloud verilerimi sil:** Firestore kayıtlarını siler, sync'i kapatır; Auth hesabı ve local veri kalır.
- **Hesabımı sil:** Önce Firestore kayıtlarını, sonra Firebase Auth hesabını siler. Auth silme başarısızsa partial state saklanır.
- **Bu cihazdaki verileri de sil:** Yalnız açıkça seçilirse user-generated Dexie tablolarını, outbox'ı, sync preference'ı, Shortcut receipt'i ve conflict audit'i temizler. Static seed kalır.
- **Backup import:** Auth UID, e-posta, token veya aktif cloud bağlantısı taşımaz.
