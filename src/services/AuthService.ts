import { create } from 'zustand'
import { firebaseAdapter } from '../sync/FirebaseAdapter'
import type { AuthAdapter, AuthIdentity } from '../sync/types'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'email_unverified' | 'auth_error' | 'unavailable'
interface AuthState { status: AuthStatus; identity?: AuthIdentity; error?: string }

export const useAuthStore = create<AuthState>(() => ({ status: 'loading' }))

export const authErrorCode = (cause: unknown) => typeof cause === 'object' && cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : cause instanceof Error ? cause.message : 'AUTH_FAILED'

export function authMessage(cause: unknown) {
  switch (authErrorCode(cause)) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'E-posta veya şifre hatalı.'
    case 'auth/email-already-in-use': return 'Bu e-posta zaten kullanımda.'
    case 'auth/invalid-email': return 'Geçerli bir e-posta adresi gir.'
    case 'auth/weak-password': return 'Daha güçlü bir parola seç.'
    case 'auth/too-many-requests': return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar dene.'
    case 'auth/network-request-failed': return 'Bağlantı kurulamadı. İnternetini kontrol et.'
    case 'auth/requires-recent-login': return 'Devam etmek için tekrar giriş yap.'
    default: return 'Hesap işlemi tamamlanamadı.'
  }
}

export class AuthService {
  private startPromise?: Promise<void>
  private lastVerificationSentAt = 0
  constructor(private readonly adapter: AuthAdapter = firebaseAdapter) {}
  get configured() { return this.adapter.configured }

  initialize() {
    this.startPromise ??= new Promise<void>((resolve) => {
      if (!this.adapter.configured) { useAuthStore.setState({ status: 'unavailable' }); resolve(); return }
      void this.adapter.onAuthStateChanged((identity) => { this.setIdentity(identity); resolve() })
        .catch(() => { useAuthStore.setState({ status: 'auth_error', error: 'AUTH_INITIALIZATION_FAILED' }); resolve() })
    })
    return this.startPromise
  }

  async createAccount(email: string, password: string) {
    try {
      const identity = await this.adapter.createAccount(email, password)
      await this.adapter.sendVerification()
      this.lastVerificationSentAt = Date.now()
      this.setIdentity(identity)
      return identity
    } catch (cause) { useAuthStore.setState({ status: 'auth_error', error: authErrorCode(cause) }); throw cause }
  }

  async signIn(email: string, password: string) {
    try { const identity = await this.adapter.signIn(email, password); this.setIdentity(identity); return identity }
    catch (cause) { useAuthStore.setState({ status: 'auth_error', error: authErrorCode(cause) }); throw cause }
  }

  async signOut() { await this.adapter.signOut(); this.setIdentity(undefined) }
  async sendPasswordReset(email: string) { await this.adapter.sendPasswordReset(email) }

  async resendVerification() {
    if (Date.now() - this.lastVerificationSentAt < 60_000) throw new Error('VERIFICATION_RATE_LIMITED')
    await this.adapter.sendVerification()
    this.lastVerificationSentAt = Date.now()
  }

  async refreshVerification() { const identity = await this.adapter.reloadIdentity(); this.setIdentity(identity); return identity }
  async reauthenticate(password: string) { const identity = await this.adapter.reauthenticate(password); this.setIdentity(identity); return identity }
  async deleteAccount() { await this.adapter.deleteAccount(); this.setIdentity(undefined) }

  private setIdentity(identity?: AuthIdentity) {
    useAuthStore.setState(identity ? { identity, error: undefined, status: identity.emailVerified ? 'authenticated' : 'email_unverified' } : { identity: undefined, error: undefined, status: 'unauthenticated' })
  }
}

export const authService = new AuthService()
