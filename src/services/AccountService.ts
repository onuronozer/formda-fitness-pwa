import { appDb, type FormdaDatabase } from '../db/database'
import type { AuthIdentity } from '../sync'
import { SyncService } from '../sync/SyncService'
import { authService, type AuthService, useAuthStore } from './AuthService'
import { LocalDataService } from './LocalDataService'
import { WorkspaceService } from './WorkspaceService'

export type AccountDeletionResult = 'deleted' | 'reauth_required' | 'partial_failure'

export class AccountService {
  private readonly workspaces: WorkspaceService
  private readonly localData: LocalDataService
  private operationInProgress = false
  private initialized = false
  private reconciliation = Promise.resolve()

  constructor(
    private readonly db: FormdaDatabase = appDb,
    private readonly auth: AuthService = authService,
    private readonly sync: SyncService = new SyncService(db),
  ) {
    this.workspaces = new WorkspaceService(db)
    this.localData = new LocalDataService(db)
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    useAuthStore.subscribe((state, previous) => {
      if (!this.operationInProgress && (state.status !== previous.status || state.identity?.uid !== previous.identity?.uid)) this.queueReconcile(state.identity, state.status)
    })
    await this.auth.initialize()
    await this.reconciliation
  }

  async createAccount(email: string, password: string, localUserId?: string) {
    return this.withOperation(async () => {
      const identity = await this.auth.createAccount(email, password)
      const resolution = await this.workspaces.resolveAuthenticated(identity, localUserId)
      if (resolution.workspace.localUserId) await this.sync.enable(resolution.workspace.localUserId, identity, resolution.workspace.id).catch((cause) => {
        if (!(cause instanceof Error && cause.message === 'EMAIL_VERIFICATION_REQUIRED')) throw cause
      })
      return { identity, workspace: resolution.workspace }
    })
  }

  async signIn(email: string, password: string, localUserId?: string) {
    return this.withOperation(async () => {
      const identity = await this.auth.signIn(email, password)
      const cloudOwner = await this.sync.inspectCloudOwner(identity)
      const safeLinkUserId = identity.emailVerified && (!cloudOwner || cloudOwner === localUserId) ? localUserId : undefined
      const resolution = await this.workspaces.resolveAuthenticated(identity, safeLinkUserId)
      const bootstrap = await this.sync.bootstrap(resolution.workspace, identity)
      return { identity, workspace: bootstrap.workspace, switchedToExistingCloudData: Boolean(localUserId && cloudOwner && cloudOwner !== localUserId) }
    })
  }

  async refreshVerification() {
    return this.withOperation(async () => {
      const identity = await this.auth.refreshVerification()
      if (!identity) return undefined
      const resolution = await this.workspaces.resolveAuthenticated(identity)
      if (identity.emailVerified) await this.sync.bootstrap(resolution.workspace, identity)
      return identity
    })
  }

  async signOut() {
    return this.withOperation(async () => {
      const identity = useAuthStore.getState().identity
      if (!identity) return
      const workspace = await this.db.localWorkspaces.where('authUid').equals(identity.uid).first()
      if (workspace?.localUserId) await this.sync.pause(workspace.localUserId)
      await this.auth.signOut()
      await this.workspaces.signOut(identity.uid)
    })
  }

  async deleteCloudData() {
    const identity = this.requireIdentity()
    const workspace = await this.requireWorkspace(identity.uid)
    if (!workspace.localUserId) return 0
    await this.sync.pause(workspace.localUserId, 'disabled')
    return this.sync.deleteCloudData(workspace.localUserId, identity)
  }

  async enableCloud() {
    const identity = this.requireIdentity()
    const workspace = await this.requireWorkspace(identity.uid)
    if (!identity.emailVerified) throw new Error('EMAIL_VERIFICATION_REQUIRED')
    return this.sync.bootstrap(workspace, identity)
  }

  async disableCloud() {
    const identity = this.requireIdentity()
    const workspace = await this.requireWorkspace(identity.uid)
    if (workspace.localUserId) await this.sync.pause(workspace.localUserId, 'disabled')
  }

  async deleteAccount(wipeLocal: boolean): Promise<AccountDeletionResult> {
    return this.withOperation(async () => {
      const identity = this.requireIdentity()
      const workspace = await this.requireWorkspace(identity.uid)
      if (workspace.localUserId) {
        await this.sync.pause(workspace.localUserId, 'disabled')
        await this.sync.deleteCloudData(workspace.localUserId, identity)
      }
      try {
        await this.auth.deleteAccount()
      } catch (cause) {
        if (workspace.localUserId) {
          const preference = await this.sync.getPreference(workspace.localUserId)
          if (preference) await this.db.cloudSyncPreferences.update(preference.id, { syncStatus: 'deletion_partial', enabled: false, updatedAt: new Date().toISOString(), version: preference.version + 1 })
        }
        return this.code(cause) === 'auth/requires-recent-login' ? 'reauth_required' : 'partial_failure'
      }
      await this.finishLocalDeletion(workspace.id, workspace.localUserId, wipeLocal)
      return 'deleted'
    })
  }

  async reauthenticateAndDelete(password: string, wipeLocal: boolean) {
    await this.auth.reauthenticate(password)
    return this.deleteAccount(wipeLocal)
  }

  private async reconcile(identity: AuthIdentity | undefined, status: string) {
    if (status === 'loading' || status === 'auth_error' || status === 'unavailable') return
    if (!identity) {
      const active = await this.workspaces.getActive()
      if (active?.ownerType === 'AUTHENTICATED' && active.authUid) {
        if (active.localUserId) await this.sync.pause(active.localUserId)
        await this.workspaces.signOut(active.authUid)
      }
      return
    }
    const resolution = await this.workspaces.resolveAuthenticated(identity)
    if (identity.emailVerified) await this.sync.bootstrap(resolution.workspace, identity)
    else if (resolution.workspace.localUserId) await this.sync.enable(resolution.workspace.localUserId, identity, resolution.workspace.id).catch(() => undefined)
  }

  private queueReconcile(identity: AuthIdentity | undefined, status: string) {
    this.reconciliation = this.reconciliation.then(() => this.reconcile(identity, status)).catch(() => undefined)
  }

  private async finishLocalDeletion(workspaceId: string, localUserId: string | undefined, wipeLocal: boolean) {
    if (localUserId && wipeLocal) await this.localData.wipeUser(localUserId)
    else if (localUserId) await this.localData.detachCloud(localUserId)
    if (wipeLocal) { await this.workspaces.remove(workspaceId); await this.workspaces.ensureLocal() }
    else await this.workspaces.detachAuthentication(workspaceId)
  }

  private requireIdentity() {
    const identity = useAuthStore.getState().identity
    if (!identity) throw new Error('AUTHENTICATION_REQUIRED')
    return identity
  }
  private async requireWorkspace(authUid: string) {
    const workspace = await this.db.localWorkspaces.where('authUid').equals(authUid).first()
    if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
    return workspace
  }
  private async withOperation<T>(work: () => Promise<T>) {
    this.operationInProgress = true
    try { return await work() } finally { this.operationInProgress = false }
  }
  private code(cause: unknown) { return typeof cause === 'object' && cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : cause instanceof Error ? cause.message : 'UNKNOWN' }
}

export const accountService = new AccountService()
