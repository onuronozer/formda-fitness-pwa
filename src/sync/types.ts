import type { SyncEntityType } from '../domain/models'

export interface AuthIdentity { uid: string; email?: string; emailVerified: boolean }
export interface CloudRecord {
  id: string
  userId: string
  localUserId: string
  entityType: SyncEntityType
  entityId: string
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown>
  entityVersion: number
  entityUpdatedAt: string
  clientId: string
  syncedAt: string
}

export interface AuthAdapter {
  readonly configured: boolean
  onAuthStateChanged(callback: (identity?: AuthIdentity) => void): Promise<() => void>
  createAccount(email: string, password: string): Promise<AuthIdentity>
  signIn(email: string, password: string): Promise<AuthIdentity>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  sendVerification(): Promise<void>
  reloadIdentity(): Promise<AuthIdentity | undefined>
  reauthenticate(password: string): Promise<AuthIdentity>
  deleteAccount(): Promise<void>
}

export interface CloudAdapter extends AuthAdapter {
  putRecord(userId: string, record: CloudRecord): Promise<void>
  listRecords(userId: string): Promise<CloudRecord[]>
  deleteAllUserData(userId: string): Promise<number>
}

export interface ConflictResolution {
  winner: 'local' | 'remote' | 'equal'
  record: Record<string, unknown>
  reason: 'missing_local' | 'higher_version' | 'newer_timestamp' | 'tombstone' | 'content_tiebreaker' | 'equal'
}
