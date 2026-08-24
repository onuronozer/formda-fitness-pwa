import { createEntityMetadata, type LocalWorkspace } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'

interface WorkspaceIdentity { uid: string; email?: string }
type WorkspaceResolution = { workspace: LocalWorkspace; created: boolean; linked: boolean }

export class WorkspaceService {
  constructor(private readonly db: FormdaDatabase = appDb) {}

  async getActive() { return this.db.localWorkspaces.where('state').equals('ACTIVE').first() }
  async getForLocalUser(localUserId: string) { return this.db.localWorkspaces.where('localUserId').equals(localUserId).first() }

  async ensureLocal(localUserId?: string) {
    const active = await this.getActive()
    if (active?.ownerType === 'LOCAL_ONLY' && (!localUserId || !active.localUserId || active.localUserId === localUserId)) {
      if (localUserId && !active.localUserId) return this.update(active, { localUserId })
      return active
    }
    if (localUserId) {
      const existing = await this.getForLocalUser(localUserId)
      if (existing) { await this.activate(existing.id); return { ...existing, state: 'ACTIVE' as const } }
    }
    const workspace: LocalWorkspace = { ...createEntityMetadata(), ownerType: 'LOCAL_ONLY', state: 'ACTIVE', localUserId }
    await this.db.transaction('rw', this.db.localWorkspaces, async () => {
      await this.deactivateAll()
      await this.db.localWorkspaces.add(workspace)
    })
    return workspace
  }

  async resolveAuthenticated(identity: WorkspaceIdentity, linkLocalUserId?: string): Promise<WorkspaceResolution> {
    const existing = await this.db.localWorkspaces.where('authUid').equals(identity.uid).first()
    if (existing) {
      const workspace = await this.update(existing, { state: 'ACTIVE', authEmail: identity.email })
      await this.activate(existing.id)
      return { workspace, created: false, linked: false }
    }
    const local = linkLocalUserId ? await this.getForLocalUser(linkLocalUserId) : undefined
    if (local && local.ownerType === 'LOCAL_ONLY') {
      const workspace = await this.update(local, { ownerType: 'AUTHENTICATED', authUid: identity.uid, authEmail: identity.email, state: 'ACTIVE' })
      await this.activate(workspace.id)
      return { workspace, created: false, linked: true }
    }
    const workspace: LocalWorkspace = { ...createEntityMetadata(), ownerType: 'AUTHENTICATED', state: 'ACTIVE', authUid: identity.uid, authEmail: identity.email }
    await this.db.transaction('rw', this.db.localWorkspaces, async () => {
      await this.deactivateAll()
      await this.db.localWorkspaces.add(workspace)
    })
    return { workspace, created: true, linked: false }
  }

  async attachLocalUser(workspaceId: string, localUserId: string) {
    const workspace = await this.db.localWorkspaces.get(workspaceId)
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
    return this.update(workspace, { localUserId })
  }

  async claimProfile(localUserId: string) {
    const active = await this.getActive()
    if (active && (!active.localUserId || active.localUserId === localUserId)) return this.attachLocalUser(active.id, localUserId)
    return this.ensureLocal(localUserId)
  }

  async signOut(authUid: string) {
    const workspace = await this.db.localWorkspaces.where('authUid').equals(authUid).first()
    if (workspace?.state === 'ACTIVE') await this.update(workspace, { state: 'INACTIVE' })
    const local = await this.db.localWorkspaces.where('ownerType').equals('LOCAL_ONLY').first()
    if (local) { await this.activate(local.id); return local }
    return this.ensureLocal()
  }

  async activate(workspaceId: string) {
    await this.db.transaction('rw', this.db.localWorkspaces, async () => {
      await this.deactivateAll(workspaceId)
      await this.db.localWorkspaces.update(workspaceId, { state: 'ACTIVE', updatedAt: new Date().toISOString() })
    })
  }

  async markDeletionPending(workspaceId: string) {
    const workspace = await this.db.localWorkspaces.get(workspaceId)
    if (workspace) await this.update(workspace, { state: 'DELETION_PENDING' })
  }

  async detachAuthentication(workspaceId: string) {
    const workspace = await this.db.localWorkspaces.get(workspaceId)
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
    const detached: LocalWorkspace = {
      ...workspace, ownerType: 'LOCAL_ONLY', state: 'ACTIVE', authUid: undefined, authEmail: undefined,
      updatedAt: new Date().toISOString(), version: workspace.version + 1,
    }
    await this.db.localWorkspaces.put(detached)
    await this.activate(detached.id)
    return detached
  }

  async remove(workspaceId: string) { await this.db.localWorkspaces.delete(workspaceId) }

  private async deactivateAll(exceptId?: string) {
    await this.db.localWorkspaces.where('state').equals('ACTIVE').filter((item) => item.id !== exceptId).modify({ state: 'INACTIVE', updatedAt: new Date().toISOString() })
  }

  private async update(workspace: LocalWorkspace, changes: Partial<LocalWorkspace>) {
    const updated = { ...workspace, ...changes, updatedAt: new Date().toISOString(), version: workspace.version + 1 }
    await this.db.localWorkspaces.put(updated)
    return updated
  }
}
