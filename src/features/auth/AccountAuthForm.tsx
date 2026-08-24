import { KeyRound, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { accountService } from '../../services/AccountService'
import { authErrorCode, authMessage, authService, useAuthStore } from '../../services/AuthService'

type Mode = 'sign_in' | 'create' | 'reset'

export function AccountAuthForm({ onConnected }: { onConnected?: () => void | Promise<void> }) {
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const auth = useAuthStore()
  const messageId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage(undefined)
    if (mode === 'create' && password !== confirmation) { setMessage({ tone: 'danger', text: 'Parolalar eşleşmiyor.' }); return }
    if (mode !== 'reset' && password.length < 8) { setMessage({ tone: 'danger', text: 'Parola en az 8 karakter olmalı.' }); return }
    setBusy(true)
    try {
      if (mode === 'reset') {
        await authService.sendPasswordReset(email.trim())
        setMessage({ tone: 'success', text: 'Bu adres için bir hesap varsa sıfırlama bağlantısı gönderildi.' })
      } else {
        if (mode === 'create') await accountService.createAccount(email.trim(), password)
        else await accountService.signIn(email.trim(), password)
        setPassword(''); setConfirmation('')
        await onConnected?.()
      }
    } catch (cause) {
      if (mode === 'reset' && ['auth/user-not-found', 'auth/invalid-credential'].includes(authErrorCode(cause))) setMessage({ tone: 'success', text: 'Bu adres için bir hesap varsa sıfırlama bağlantısı gönderildi.' })
      else setMessage({ tone: 'danger', text: authMessage(cause) })
    }
    finally { setBusy(false) }
  }

  const resend = async () => {
    setBusy(true); setMessage(undefined)
    try { await authService.resendVerification(); setMessage({ tone: 'success', text: 'Doğrulama e-postası yeniden gönderildi.' }) }
    catch (cause) { setMessage({ tone: 'danger', text: cause instanceof Error && cause.message === 'VERIFICATION_RATE_LIMITED' ? 'Tekrar göndermeden önce kısa bir süre bekle.' : authMessage(cause) }) }
    finally { setBusy(false) }
  }

  const checkVerification = async () => {
    setBusy(true); setMessage(undefined)
    try {
      const identity = await accountService.refreshVerification()
      if (identity?.emailVerified) { setMessage({ tone: 'success', text: 'E-posta doğrulandı.' }); await onConnected?.() }
      else setMessage({ tone: 'danger', text: 'E-posta henüz doğrulanmamış.' })
    } catch (cause) { setMessage({ tone: 'danger', text: authMessage(cause) }) }
    finally { setBusy(false) }
  }

  if (auth.status === 'email_unverified') return <div className="verification-panel" aria-describedby={message ? messageId : undefined}>
    <MailCheck size={26} /><strong>E-postanı doğrula</strong><p>{auth.identity?.email}</p>
    <button className="primary-button compact-button" onClick={checkVerification} disabled={busy}>{busy && <LoaderCircle className="spin" size={17} />}Doğrulamayı kontrol et</button>
    <button className="secondary-button compact-button" onClick={resend} disabled={busy}>Tekrar gönder</button>
    {message && <p id={messageId} className={`inline-message ${message.tone}`} role="status">{message.text}</p>}
  </div>

  return <form className="cloud-auth-form" onSubmit={submit} aria-describedby={message ? messageId : undefined}>
    {mode !== 'reset' && <div className="settings-segmented" role="tablist" aria-label="Hesap işlemi"><button type="button" role="tab" aria-selected={mode === 'sign_in'} className={mode === 'sign_in' ? 'active' : ''} onClick={() => setMode('sign_in')}>Giriş Yap</button><button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Hesap Oluştur</button></div>}
    <label>E-posta<input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={!authService.configured || busy} /></label>
    {mode !== 'reset' && <label>Parola<input type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></label>}
    {mode === 'create' && <label>Parola tekrar<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></label>}
    <button className="primary-button compact-button" disabled={busy || !authService.configured}>{busy ? <LoaderCircle className="spin" size={18} /> : mode === 'reset' ? <KeyRound size={18} /> : <ShieldCheck size={18} />}{mode === 'reset' ? 'Sıfırlama Bağlantısı Gönder' : mode === 'create' ? 'Hesap Oluştur' : 'Giriş Yap'}</button>
    <button type="button" className="text-command auth-text-command" onClick={() => { setMessage(undefined); setMode(mode === 'reset' ? 'sign_in' : 'reset') }}>{mode === 'reset' ? 'Girişe dön' : 'Şifremi unuttum'}</button>
    {message && <p id={messageId} className={`inline-message ${message.tone}`} role="status">{message.text}</p>}
  </form>
}
