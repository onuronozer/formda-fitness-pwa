import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { UserRepository } from '../db/repositories'
import { AccountService } from '../services/AccountService'
import { AuthService, useAuthStore } from '../services/AuthService'
import { WorkspaceService } from '../services/WorkspaceService'
import { SyncService } from '../sync'
import { USER_ID, validProfile } from './fixtures'
import { MemoryCloudAdapter } from './MemoryCloudAdapter'

const names: string[] = []
const create = () => { const name = `formda-delete-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
const identity = { uid: 'cloud-user-a', email: 'user@example.test', emailVerified: true }
beforeEach(() => useAuthStore.setState({ status: 'loading', identity: undefined, error: undefined }))
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

async function setup() {
  const db = create(); const cloud = new MemoryCloudAdapter(identity); const auth = new AuthService(cloud); const sync = new SyncService(db, cloud)
  await new UserRepository(db).save(validProfile)
  await auth.signIn('user@example.test', 'StrongPass123!')
  await new WorkspaceService(db).resolveAuthenticated(identity, USER_ID)
  await sync.enable(USER_ID, identity)
  return { db, cloud, auth, sync, account: new AccountService(db, auth, sync) }
}

describe('account and cloud deletion', () => {
  it('deletes cloud data only while preserving Auth and local records', async () => {
    const { db, cloud, account } = await setup()
    expect(cloud.records.size).toBeGreaterThan(0)
    await account.deleteCloudData()
    expect(cloud.records.size).toBe(0); expect(cloud.accountDeleted).toBe(false); expect(await db.userProfiles.get(USER_ID)).toBeTruthy(); db.close()
  })

  it('deletes cloud data then the Auth account while keeping local data by default', async () => {
    const { db, cloud, account } = await setup()
    expect(await account.deleteAccount(false)).toBe('deleted')
    expect(cloud.accountDeleted).toBe(true); expect(await db.userProfiles.get(USER_ID)).toBeTruthy()
    expect(await new WorkspaceService(db).getActive()).toMatchObject({ ownerType: 'LOCAL_ONLY', localUserId: USER_ID }); db.close()
  })

  it('wipes all user-generated local data only when explicitly selected', async () => {
    const { db, account } = await setup()
    expect(await account.deleteAccount(true)).toBe('deleted')
    expect(await db.userProfiles.get(USER_ID)).toBeUndefined(); expect(await db.syncOutbox.where('userId').equals(USER_ID).count()).toBe(0)
    expect((await new WorkspaceService(db).getActive())?.ownerType).toBe('LOCAL_ONLY'); db.close()
  })

  it('records a partial deletion instead of reporting success', async () => {
    const { db, cloud, account } = await setup(); cloud.deleteAccountError = { code: 'auth/internal-error' }
    expect(await account.deleteAccount(false)).toBe('partial_failure')
    expect(cloud.records.size).toBe(0); expect((await db.cloudSyncPreferences.where('userId').equals(USER_ID).first())?.syncStatus).toBe('deletion_partial')
    expect(await db.userProfiles.get(USER_ID)).toBeTruthy(); db.close()
  })

  it('recovers from recent-login-required through reauthentication', async () => {
    const { db, cloud, account } = await setup(); cloud.deleteAccountError = { code: 'auth/requires-recent-login' }
    expect(await account.deleteAccount(false)).toBe('reauth_required')
    cloud.deleteAccountError = undefined
    expect(await account.reauthenticateAndDelete('StrongPass123!', false)).toBe('deleted')
    expect(cloud.reauthenticated).toBe(true); expect(cloud.accountDeleted).toBe(true); db.close()
  })
})
