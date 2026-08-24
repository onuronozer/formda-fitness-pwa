import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { versionFiveStores } from '../db/schema'
import { UserRepository } from '../db/repositories'
import { WaterService } from '../services/WaterService'
import { WorkspaceService } from '../services/WorkspaceService'
import { SyncQueue } from '../sync'
import { USER_ID, validProfile } from './fixtures'

const names: string[] = []
const create = () => { const name = `formda-workspace-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
const profileB = { ...validProfile, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Ece' }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('local workspace ownership', () => {
  it('migrates a legacy v5 local profile into an active LOCAL_ONLY workspace', async () => {
    const name = `formda-workspace-${crypto.randomUUID()}`; names.push(name)
    const legacy = new Dexie(name); legacy.version(5).stores(versionFiveStores); await legacy.open(); await legacy.table('userProfiles').put(validProfile); legacy.close()
    const db = new FormdaDatabase(name); await db.open()
    expect(await new WorkspaceService(db).getActive()).toMatchObject({ ownerType: 'LOCAL_ONLY', localUserId: USER_ID, state: 'ACTIVE' })
    db.close()
  })

  it('links local ownership without rewriting the domain userId', async () => {
    const db = create(); await new UserRepository(db).save(validProfile)
    const result = await new WorkspaceService(db).resolveAuthenticated({ uid: 'cloud-user-a', email: 'a@example.test' }, USER_ID)
    expect(result).toMatchObject({ linked: true, workspace: { authUid: 'cloud-user-a', localUserId: USER_ID } })
    expect((await db.userProfiles.get(USER_ID))?.id).toBe(USER_ID); db.close()
  })

  it('hides A after logout, isolates A outbox from B, and restores A on relogin', async () => {
    const db = create(); const users = new UserRepository(db); const workspaces = new WorkspaceService(db)
    await users.save(validProfile); await workspaces.resolveAuthenticated({ uid: 'cloud-user-a' }, USER_ID)
    await new WaterService(db).addShortcut(USER_ID, 250, 'shortcut-user-a')
    const pendingA = await new SyncQueue(db).listReady(USER_ID)
    await workspaces.signOut('cloud-user-a')
    expect(await users.getActive()).toBeUndefined()
    await users.save(profileB); await workspaces.resolveAuthenticated({ uid: 'cloud-user-b' }, profileB.id)
    await new WaterService(db).addShortcut(profileB.id, 250, 'shortcut-user-b')
    expect((await users.getActive())?.displayName).toBe('Ece')
    expect(await new SyncQueue(db).listReady(profileB.id)).toHaveLength(2)
    expect(await new SyncQueue(db).listReady(USER_ID)).toHaveLength(pendingA.length)
    await workspaces.resolveAuthenticated({ uid: 'cloud-user-a' })
    expect((await users.getActive())?.displayName).toBe('Deniz')
    expect(await db.waterRecords.where('userId').equals(profileB.id).count()).toBe(1)
    db.close()
  })
})
