import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseEnvironment } from '../config/firebaseEnvironment'
import type { AuthIdentity, CloudAdapter, CloudRecord } from './types'

interface FirebaseContext { app: FirebaseApp; auth: Auth; firestore: Firestore }

const identity = (user: User): AuthIdentity => ({ uid: user.uid, email: user.email ?? undefined, emailVerified: user.emailVerified })

export class FirebaseAdapter implements CloudAdapter {
  readonly configured = firebaseEnvironment.configured
  private context?: Promise<FirebaseContext>

  private async getContext() {
    if (!this.configured || !firebaseEnvironment.config) throw new Error(firebaseEnvironment.issue ?? 'FIREBASE_NOT_CONFIGURED')
    this.context ??= this.initialize()
    return this.context
  }

  private async initialize(): Promise<FirebaseContext> {
    const [{ getApps, initializeApp }, authModule, firestoreModule] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const app = getApps().find((candidate) => candidate.options.projectId === firebaseEnvironment.config!.projectId) ?? initializeApp(firebaseEnvironment.config!)
    if (firebaseEnvironment.environment === 'production' && firebaseEnvironment.appCheckSiteKey && !firebaseEnvironment.useEmulator) {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check')
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(firebaseEnvironment.appCheckSiteKey), isTokenAutoRefreshEnabled: true })
    }
    const auth = authModule.getAuth(app)
    await authModule.setPersistence(auth, authModule.browserLocalPersistence)
    let firestore: Firestore
    try { firestore = firestoreModule.initializeFirestore(app, { localCache: firestoreModule.memoryLocalCache() }) }
    catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      if (code !== 'failed-precondition') throw cause
      firestore = firestoreModule.getFirestore(app)
    }
    if (firebaseEnvironment.useEmulator) {
      authModule.connectAuthEmulator(auth, firebaseEnvironment.authEmulatorUrl, { disableWarnings: true })
      firestoreModule.connectFirestoreEmulator(firestore, firebaseEnvironment.firestoreEmulatorHost, firebaseEnvironment.firestoreEmulatorPort)
    }
    return { app, auth, firestore }
  }

  async onAuthStateChanged(callback: (current?: AuthIdentity) => void) {
    if (!this.configured) { callback(undefined); return () => undefined }
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([this.getContext(), import('firebase/auth')])
    return onAuthStateChanged(auth, (user) => callback(user ? identity(user) : undefined))
  }

  async createAccount(email: string, password: string) {
    const [{ auth }, { createUserWithEmailAndPassword }] = await Promise.all([this.getContext(), import('firebase/auth')])
    return identity((await createUserWithEmailAndPassword(auth, email, password)).user)
  }

  async signIn(email: string, password: string) {
    const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([this.getContext(), import('firebase/auth')])
    return identity((await signInWithEmailAndPassword(auth, email, password)).user)
  }

  async signOut() {
    const [{ auth }, authModule] = await Promise.all([this.getContext(), import('firebase/auth')])
    await authModule.signOut(auth)
  }

  async sendPasswordReset(email: string) {
    const [{ auth }, { sendPasswordResetEmail }] = await Promise.all([this.getContext(), import('firebase/auth')])
    await sendPasswordResetEmail(auth, email)
  }

  async sendVerification() {
    const [{ auth }, { sendEmailVerification }] = await Promise.all([this.getContext(), import('firebase/auth')])
    if (!auth.currentUser) throw new Error('AUTHENTICATION_REQUIRED')
    await sendEmailVerification(auth.currentUser)
  }

  async reloadIdentity() {
    const [{ auth }, { getIdToken, reload }] = await Promise.all([this.getContext(), import('firebase/auth')])
    if (!auth.currentUser) return undefined
    await reload(auth.currentUser)
    await getIdToken(auth.currentUser, true)
    return identity(auth.currentUser)
  }

  async reauthenticate(password: string) {
    const [{ auth }, { EmailAuthProvider, reauthenticateWithCredential }] = await Promise.all([this.getContext(), import('firebase/auth')])
    const user = auth.currentUser
    if (!user?.email) throw new Error('AUTHENTICATION_REQUIRED')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
    return identity(user)
  }

  async deleteAccount() {
    const [{ auth }, { deleteUser }] = await Promise.all([this.getContext(), import('firebase/auth')])
    if (!auth.currentUser) throw new Error('AUTHENTICATION_REQUIRED')
    await deleteUser(auth.currentUser)
  }

  async putRecord(userId: string, record: CloudRecord) {
    const [{ firestore }, { doc, setDoc }] = await Promise.all([this.getContext(), import('firebase/firestore')])
    await setDoc(doc(firestore, 'users', userId, 'records', record.id), JSON.parse(JSON.stringify(record)))
  }

  async listRecords(userId: string) {
    const [{ firestore }, { collection, getDocs, query, where }] = await Promise.all([this.getContext(), import('firebase/firestore')])
    const snapshot = await getDocs(query(collection(firestore, 'users', userId, 'records'), where('userId', '==', userId)))
    return snapshot.docs.map((item) => item.data() as CloudRecord)
  }

  async deleteAllUserData(userId: string) {
    const [{ firestore }, { collection, getDocs, query, where, writeBatch }] = await Promise.all([this.getContext(), import('firebase/firestore')])
    const snapshot = await getDocs(query(collection(firestore, 'users', userId, 'records'), where('userId', '==', userId)))
    let deleted = 0
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = writeBatch(firestore)
      const group = snapshot.docs.slice(index, index + 400)
      group.forEach((item) => batch.delete(item.ref))
      await batch.commit()
      deleted += group.length
    }
    return deleted
  }
}

export const firebaseAdapter = new FirebaseAdapter()
