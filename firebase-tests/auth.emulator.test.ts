import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, getAuth, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const PROJECT_ID = 'demo-formda-fitness'
const AUTH_URL = process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}` : 'http://127.0.0.1:9099'
const app = initializeApp({ apiKey: 'demo-api-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com`, appId: 'demo-app' }, 'formda-auth-emulator-tests')
const auth = getAuth(app)
connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true })

async function clearAccounts() {
  await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' })
}

async function codes() {
  const response = await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/oobCodes`)
  return response.json() as Promise<{ oobCodes?: Array<{ email: string; requestType: string; oobLink: string }> }>
}

beforeAll(clearAccounts)
beforeEach(async () => { if (auth.currentUser) await signOut(auth); await clearAccounts() })
afterAll(async () => { await clearAccounts(); await deleteApp(app) })

describe('Firebase Auth emulator lifecycle', () => {
  it('creates, verifies and signs in an email/password account', async () => {
    const credential = await createUserWithEmailAndPassword(auth, 'verified@example.test', 'StrongPass123!')
    expect(credential.user.emailVerified).toBe(false)
    await sendEmailVerification(credential.user)
    const verification = (await codes()).oobCodes?.find((item) => item.requestType === 'VERIFY_EMAIL')
    expect(verification?.email).toBe('verified@example.test')
    await fetch(verification!.oobLink)
    await reload(credential.user)
    expect(credential.user.emailVerified).toBe(true)
    await signOut(auth)
    await expect(signInWithEmailAndPassword(auth, 'verified@example.test', 'wrong-password')).rejects.toSatisfy((cause: unknown) => typeof cause === 'object' && cause !== null && 'code' in cause && ['auth/invalid-credential', 'auth/wrong-password'].includes(String(cause.code)))
    await expect(signInWithEmailAndPassword(auth, 'verified@example.test', 'StrongPass123!')).resolves.toBeTruthy()
  })

  it('creates a password reset out-of-band contract', async () => {
    await createUserWithEmailAndPassword(auth, 'reset@example.test', 'StrongPass123!')
    await sendPasswordResetEmail(auth, 'reset@example.test')
    const reset = (await codes()).oobCodes?.find((item) => item.requestType === 'PASSWORD_RESET')
    expect(reset?.email).toBe('reset@example.test')
    expect(reset?.oobLink).toContain('mode=resetPassword')
  })

  it('deletes the authenticated account', async () => {
    const credential = await createUserWithEmailAndPassword(auth, 'delete@example.test', 'StrongPass123!')
    await deleteUser(credential.user)
    await expect(signInWithEmailAndPassword(auth, 'delete@example.test', 'StrongPass123!')).rejects.toSatisfy((cause: unknown) => typeof cause === 'object' && cause !== null && 'code' in cause && ['auth/invalid-credential', 'auth/user-not-found'].includes(String(cause.code)))
  })
})
