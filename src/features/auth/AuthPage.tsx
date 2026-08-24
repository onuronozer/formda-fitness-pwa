import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLogo } from '../../components/AppLogo'
import { UserRepository } from '../../db/repositories'
import { authService, useAuthStore } from '../../services/AuthService'
import { AccountAuthForm } from './AccountAuthForm'

const users = new UserRepository()

export function AuthPage() {
  const navigate = useNavigate()
  const profile = useLiveQuery(() => users.getActive())
  const authStatus = useAuthStore((state) => state.status)
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    void users.getActive().then((active) => navigate(active ? '/today' : '/onboarding', { replace: true }))
  }, [authStatus, navigate])
  const connected = async () => {
    if (useAuthStore.getState().status === 'email_unverified') return
    navigate((await users.getActive()) ? '/today' : '/onboarding', { replace: true })
  }
  return <main className="app-canvas auth-screen"><section className="auth-shell">
    <header><AppLogo /></header>
    <div><h1>Giriş Yap</h1>{!authService.configured && <p className="settings-notice">Cloud şu anda kullanılamıyor.</p>}<AccountAuthForm localUserId={profile?.id} onConnected={connected} /></div>
  </section></main>
}
