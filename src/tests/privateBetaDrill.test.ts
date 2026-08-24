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
const createDb = () => {
  const name = `formda-private-beta-${crypto.randomUUID()}`
  names.push(name)
  return new FormdaDatabase(name)
}

beforeEach(() => useAuthStore.setState({ status: 'loading', identity: undefined, error: undefined }))
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

function client(db: FormdaDatabase, cloud: MemoryCloudAdapter) {
  const auth = new AuthService(cloud)
  const sync = new SyncService(db, cloud)
  return { account: new AccountService(db, auth, sync), auth, sync }
}

describe('private beta account lifecycle drill', () => {
  it('creates, verifies, syncs, restores, deletes cloud data and wipes the account workspace', async () => {
    const email = 'beta@example.test'
    const cloud = new MemoryCloudAdapter(undefined, true)
    const firstDb = createDb()
    const first = client(firstDb, cloud)

    const created = await first.account.createAccount(email, 'StrongPass123!')
    expect(created.identity.emailVerified).toBe(false)
    expect(cloud.verificationSent).toBe(1)

    await new UserRepository(firstDb).save(validProfile)
    await new WorkspaceService(firstDb).attachLocalUser(created.workspace.id, USER_ID)
    expect((await first.account.refreshVerification())?.emailVerified).toBe(true)
    expect(cloud.records.size).toBeGreaterThan(0)

    await first.account.signOut()
    firstDb.close()

    const restoredDb = createDb()
    const restored = client(restoredDb, cloud)
    const signedIn = await restored.account.signIn(email, 'StrongPass123!')
    expect(signedIn.workspace.localUserId).toBe(USER_ID)
    expect(await restoredDb.userProfiles.get(USER_ID)).toMatchObject({ displayName: validProfile.displayName })

    expect(await restored.account.deleteCloudData()).toBeGreaterThan(0)
    expect(cloud.records.size).toBe(0)
    expect(await restored.account.deleteAccount(true)).toBe('deleted')
    expect(cloud.accountDeleted).toBe(true)
    expect(await restoredDb.userProfiles.get(USER_ID)).toBeUndefined()
    expect(await new WorkspaceService(restoredDb).getActive()).toMatchObject({ ownerType: 'LOCAL_ONLY' })
    restoredDb.close()
  })
})
