import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudOff, LogOut, RefreshCw, Trash2, UserRoundX } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { appDb } from '../../db/database'
import { accountService } from '../../services/AccountService'
import { authMessage, authService, useAuthStore } from '../../services/AuthService'
import { SyncService } from '../../sync'
import { AccountAuthForm } from '../auth/AccountAuthForm'

const syncService = new SyncService()
const statusLabels = {
  pending: 'Bekliyor', syncing: 'Eşitleniyor', synced: 'Güncel', error: 'Eşitleme hatası', offline: 'Çevrimdışı', disabled: 'Kapalı',
  verification_required: 'Doğrulama gerekli', authentication_required: 'Giriş gerekli', deletion_partial: 'İşlem yarım kaldı',
} as const

export function CloudSyncPanel({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const preference = useLiveQuery(() => appDb.cloudSyncPreferences.where('userId').equals(userId).first(), [userId])
  const auth = useAuthStore()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const [deleteCloudOpen, setDeleteCloudOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [wipeLocal, setWipeLocal] = useState(false)
  const [reauthRequired, setReauthRequired] = useState(false)
  const [reauthPassword, setReauthPassword] = useState('')

  const run = async (work: () => Promise<void>, failure = 'İşlem tamamlanamadı.') => {
    setBusy(true); setMessage(undefined)
    try { await work() } catch (cause) { setMessage({ tone: 'danger', text: authMessage(cause) === 'Hesap işlemi tamamlanamadı.' ? failure : authMessage(cause) }) }
    finally { setBusy(false) }
  }

  const signOut = () => run(async () => { await accountService.signOut(); setMessage({ tone: 'success', text: 'Çıkış yapıldı. Yerel verilerin duruyor.' }); navigate('/', { replace: true }) }, 'Çıkış yapılamadı.')
  const deleteCloud = () => run(async () => { setDeleteCloudOpen(false); await accountService.deleteCloudData(); setMessage({ tone: 'success', text: 'Cloud kopyaların silindi.' }) }, 'Cloud verileri silinemedi.')

  const deleteAccount = () => run(async () => {
    setDeleteAccountOpen(false)
    const result = await accountService.deleteAccount(wipeLocal)
    if (result === 'reauth_required') { setReauthRequired(true); setMessage({ tone: 'danger', text: 'Devam etmek için tekrar giriş yap.' }); return }
    if (result === 'partial_failure') { setMessage({ tone: 'danger', text: 'Cloud verilerin silindi ancak hesap silinemedi. Tekrar dene.' }); return }
    navigate('/', { replace: true })
  }, 'Hesap silinemedi.')

  const reauthenticate = () => run(async () => {
    const result = await accountService.reauthenticateAndDelete(reauthPassword, wipeLocal)
    if (result !== 'deleted') throw new Error('ACCOUNT_DELETE_FAILED')
    setReauthRequired(false); setReauthPassword(''); navigate('/', { replace: true })
  })

  const connected = async () => setMessage({ tone: 'success', text: useAuthStore.getState().identity?.emailVerified ? 'Cloud Sync hazır.' : 'Doğrulama e-postası gönderildi.' })
  const status = preference?.syncStatus ?? 'disabled'
  const authenticated = auth.status === 'authenticated' || auth.status === 'email_unverified'

  return <section className="settings-section cloud-sync-section"><header><div><h2>Cloud Sync</h2><p>Hesabınla cihazlar arasında eşitle.</p></div><span className={`sync-pill ${status}`}>{preference?.enabled ? <Cloud size={15} /> : <CloudOff size={15} />}{statusLabels[status]}</span></header>
    {!authService.configured && <p className="settings-notice">Cloud şu anda kullanılamıyor. Yerel özellikler çalışmaya devam eder.</p>}
    {!authenticated ? <AccountAuthForm onConnected={connected} /> : auth.status === 'email_unverified' ? <AccountAuthForm onConnected={connected} /> : <div className="cloud-connected">
      <div><Cloud size={19} /><span><strong>{auth.identity?.email}</strong><small>{preference?.lastSyncedAt ? `Son eşitleme ${new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(preference.lastSyncedAt))}` : 'İlk eşitleme bekleniyor'}</small></span></div>
      <div className="settings-actions">
        <button className="secondary-button compact-button" onClick={() => run(async () => { await accountService.enableCloud(); setMessage({ tone: 'success', text: 'Cloud Sync açık.' }) })} disabled={busy || preference?.enabled}><Cloud size={17} /> Aç</button>
        <button className="secondary-button compact-button" onClick={() => run(async () => { await accountService.disableCloud(); setMessage({ tone: 'success', text: 'Cloud Sync kapalı.' }) })} disabled={busy || !preference?.enabled}><CloudOff size={17} /> Kapat</button>
        <button className="secondary-button compact-button" onClick={() => run(async () => { await syncService.syncNow(userId); setMessage({ tone: 'success', text: 'Veriler güncel.' }) }, 'Eşitleme tamamlanamadı.')} disabled={busy || !preference?.enabled}><RefreshCw size={17} /> Eşitle</button>
        <button className="secondary-button compact-button" onClick={signOut} disabled={busy}><LogOut size={17} /> Çıkış</button>
      </div>
      <button className="danger-text-button" onClick={() => setDeleteCloudOpen(true)}><Trash2 size={16} /> Cloud verilerimi sil</button>
      <button className="danger-text-button" onClick={() => setDeleteAccountOpen(true)}><UserRoundX size={16} /> Hesabımı sil</button>
    </div>}
    {reauthRequired && <form className="cloud-auth-form reauth-form" onSubmit={(event) => { event.preventDefault(); void reauthenticate() }}><label>Parola<input type="password" autoComplete="current-password" required minLength={8} value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} /></label><button className="danger-button" disabled={busy}>Tekrar giriş yap ve sil</button></form>}
    {message && <p className={`inline-message ${message.tone}`} role="status">{message.text}</p>}
    <ConfirmDialog open={deleteCloudOpen} title="Cloud verileri silinsin mi?" message="Cloud kayıtların silinir ve eşitleme kapanır. Bu cihazdaki veriler kalır." onCancel={() => setDeleteCloudOpen(false)} onConfirm={() => void deleteCloud()} />
    {deleteAccountOpen && <div className="dialog-backdrop"><section className="confirm-dialog account-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title"><UserRoundX size={24} /><h2 id="account-delete-title">Hesabı Sil</h2><p>Cloud hesabın ve bulut verilerin silinecek.</p><label><input type="checkbox" checked={wipeLocal} onChange={(event) => setWipeLocal(event.target.checked)} /> Bu cihazdaki verileri de sil</label><div><button className="secondary-button" onClick={() => setDeleteAccountOpen(false)}>Vazgeç</button><button className="danger-button" onClick={() => void deleteAccount()}>Sil</button></div></section></div>}
  </section>
}
