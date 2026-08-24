import type { AuthIdentity, CloudAdapter, CloudRecord } from '../sync'

export class MemoryCloudAdapter implements CloudAdapter {
  readonly configured: boolean
  records = new Map<string, CloudRecord>()
  identity?: AuthIdentity
  failNext = false
  deleteAccountError?: { code: string }
  verificationSent = 0
  resetEmails: string[] = []
  reauthenticated = false
  accountDeleted = false
  private readonly accountUids = new Map<string, string>()
  private listener?: (identity?: AuthIdentity) => void

  constructor(identity: AuthIdentity = { uid: 'cloud-user-a', email: 'user@example.test', emailVerified: true }, configured = true) {
    this.identity = identity
    this.configured = configured
  }

  async onAuthStateChanged(callback: (identity?: AuthIdentity) => void) { this.listener = callback; callback(this.identity); return () => { this.listener = undefined } }
  async createAccount(email: string) {
    const uid = `uid-${email}`
    this.accountUids.set(email, uid)
    this.identity = { uid, email, emailVerified: false }; this.listener?.(this.identity); return this.identity
  }
  async signIn(email: string, password: string) {
    if (password === 'invalid') { const cause = new Error('invalid') as Error & { code: string }; cause.code = 'auth/invalid-credential'; throw cause }
    this.identity = { uid: this.accountUids.get(email) ?? (email.startsWith('b@') ? 'cloud-user-b' : 'cloud-user-a'), email, emailVerified: true }
    this.listener?.(this.identity); return this.identity
  }
  async signOut() { this.identity = undefined; this.listener?.(undefined) }
  async sendPasswordReset(email: string) { this.resetEmails.push(email) }
  async sendVerification() { this.verificationSent += 1 }
  async reloadIdentity() { if (this.identity) this.identity = { ...this.identity, emailVerified: true }; return this.identity }
  async reauthenticate() { this.reauthenticated = true; if (!this.identity) throw new Error('AUTHENTICATION_REQUIRED'); return this.identity }
  async deleteAccount() {
    if (this.deleteAccountError) throw this.deleteAccountError
    this.accountDeleted = true; this.identity = undefined; this.listener?.(undefined)
  }
  async putRecord(_userId: string, record: CloudRecord) { if (this.failNext) { this.failNext = false; throw new Error('network-failed') } this.records.set(record.id, structuredClone(record)) }
  async listRecords(userId: string) { return [...this.records.values()].filter((record) => record.userId === userId).map((record) => structuredClone(record)) }
  async deleteAllUserData(userId: string) { const records = await this.listRecords(userId); records.forEach((record) => this.records.delete(record.id)); return records.length }
}
