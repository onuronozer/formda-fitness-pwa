import type { FormdaDatabase } from '../database'
import { appDb } from '../database'
import type { UserProfile } from '../../domain/models'
import { SyncQueue } from '../../sync/SyncQueue'
import { WorkspaceService } from '../../services/WorkspaceService'

export class UserRepository {
  private readonly queue: SyncQueue
  private readonly workspaces: WorkspaceService
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db); this.workspaces = new WorkspaceService(db) }

  async getActive(): Promise<UserProfile | undefined> {
    const workspace = await this.workspaces.getActive()
    if (!workspace?.localUserId) return undefined
    return this.getById(workspace.localUserId)
  }

  async getById(id: string): Promise<UserProfile | undefined> {
    const profile = await this.db.userProfiles.get(id)
    return profile?.deletedAt ? undefined : profile
  }

  async save(profile: UserProfile): Promise<UserProfile> {
    const existing = await this.db.userProfiles.get(profile.id)
    const saved: UserProfile = {
      ...profile,
      createdAt: existing?.createdAt ?? profile.createdAt,
      updatedAt: new Date().toISOString(),
      version: existing ? existing.version + 1 : profile.version,
    }
    await this.db.transaction('rw', [this.db.userProfiles, this.db.syncOutbox], async () => {
      await this.db.userProfiles.put(saved)
      await this.queue.enqueue(saved.id, 'userProfiles', saved as UserProfile & Record<string, unknown>)
    })
    await this.workspaces.claimProfile(saved.id)
    return saved
  }
}
