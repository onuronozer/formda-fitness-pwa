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
const create = () => { const name = `formda-account-isolation-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
beforeEach(() => useAuthStore.setState({ status: 'loading', identity: undefined, error: undefined }))
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

function accountFor(db: FormdaDatabase, cloud = new MemoryCloudAdapter(undefined, true)) {
  const auth = new AuthService(cloud)
  return { account: new AccountService(db, auth, new SyncService(db, cloud)), auth, cloud }
}

describe('account profile isolation', () => {
  it('creates a fresh workspace instead of claiming the existing local profile', async () => {
    const db = create(); const users = new UserRepository(db)
    await users.save(validProfile)
    const { account } = accountFor(db)

    const result = await account.createAccount('new@example.test', 'StrongPass123!')

    expect(result.workspace).toMatchObject({ ownerType: 'AUTHENTICATED', authUid: 'uid-new@example.test', state: 'ACTIVE' })
    expect(result.workspace.localUserId).toBeUndefined()
    expect(await users.getActive()).toBeUndefined()
    expect(await db.localWorkspaces.where('localUserId').equals(USER_ID).first()).toMatchObject({ ownerType: 'LOCAL_ONLY', state: 'INACTIVE' })
    db.close()
  })

  it('does not reveal a local profile when another account signs in to an empty cloud', async () => {
    const db = create(); const users = new UserRepository(db)
    await users.save(validProfile)
    const { account } = accountFor(db)

    const result = await account.signIn('b@example.test', 'StrongPass123!')

    expect(result.workspace).toMatchObject({ authUid: 'cloud-user-b', state: 'ACTIVE' })
    expect(result.workspace.localUserId).toBeUndefined()
    expect(await users.getActive()).toBeUndefined()
    expect(await db.userProfiles.get(USER_ID)).toBeTruthy()
    db.close()
  })

  it('restores the profile already owned by the same authenticated workspace', async () => {
    const db = create(); const users = new UserRepository(db); const workspaces = new WorkspaceService(db)
    await users.save(validProfile)
    await workspaces.resolveAuthenticated({ uid: 'cloud-user-a', email: 'a@example.test' }, USER_ID)
    await workspaces.signOut('cloud-user-a')
    const { account } = accountFor(db)

    const result = await account.signIn('a@example.test', 'StrongPass123!')

    expect(result.workspace).toMatchObject({ authUid: 'cloud-user-a', localUserId: USER_ID, state: 'ACTIVE' })
    expect((await users.getActive())?.id).toBe(USER_ID)
    db.close()
  })
})
