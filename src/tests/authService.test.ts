import { beforeEach, describe, expect, it } from 'vitest'
import { AuthService, authMessage, useAuthStore } from '../services/AuthService'
import { MemoryCloudAdapter } from './MemoryCloudAdapter'

beforeEach(() => useAuthStore.setState({ status: 'loading', identity: undefined, error: undefined }))

describe('AuthService lifecycle', () => {
  it('keeps local-only startup available when Firebase is not configured', async () => {
    const adapter = new MemoryCloudAdapter(undefined, false)
    await new AuthService(adapter).initialize()
    expect(useAuthStore.getState().status).toBe('unavailable')
  })

  it('restores an existing verified session through the centralized listener', async () => {
    const service = new AuthService(new MemoryCloudAdapter())
    await service.initialize()
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', identity: { uid: 'cloud-user-a' } })
  })

  it('creates an unverified account and sends verification', async () => {
    const adapter = new MemoryCloudAdapter()
    const service = new AuthService(adapter)
    await service.createAccount('new@example.test', 'StrongPass123!')
    expect(adapter.verificationSent).toBe(1)
    expect(useAuthStore.getState().status).toBe('email_unverified')
  })

  it('maps invalid login without exposing a raw Firebase code', async () => {
    const service = new AuthService(new MemoryCloudAdapter())
    await expect(service.signIn('user@example.test', 'invalid')).rejects.toBeTruthy()
    expect(authMessage({ code: 'auth/invalid-credential' })).toBe('E-posta veya şifre hatalı.')
  })

  it('supports password reset, verification refresh, resend throttling and sign-out', async () => {
    const adapter = new MemoryCloudAdapter({ uid: 'cloud-user-a', email: 'user@example.test', emailVerified: false })
    const service = new AuthService(adapter)
    await service.sendPasswordReset('user@example.test')
    await service.resendVerification()
    await expect(service.resendVerification()).rejects.toThrow('VERIFICATION_RATE_LIMITED')
    expect((await service.refreshVerification())?.emailVerified).toBe(true)
    await service.signOut()
    expect(adapter.resetEmails).toEqual(['user@example.test'])
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })
})
