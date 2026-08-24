import { createEntityMetadata, type CloudSyncPreference, type EntityMetadata, type LocalWorkspace, type SyncConflictAudit, type SyncEntityType } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'
import { cloudSyncPreferenceSchema } from '../validation/phase3bSchemas'
import { ConflictResolver } from './ConflictResolver'
import { firebaseAdapter } from './FirebaseAdapter'
import { SyncQueue } from './SyncQueue'
import type { AuthIdentity, CloudAdapter, CloudRecord } from './types'

export const SYNCABLE_ENTITY_TYPES: SyncEntityType[] = ['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutPlans', 'workoutDays', 'workoutExercises', 'workoutSessions', 'workoutSets', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions', 'foods', 'recipes', 'recipeIngredients', 'favoriteFoods', 'meals', 'mealItems', 'dailyNutritionTargets', 'nutritionSettings']

const RESTORE_ORDER = new Map(SYNCABLE_ENTITY_TYPES.map((type, index) => [type, index]))
const directUserTables = new Set<SyncEntityType>(['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutPlans', 'workoutSessions', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions', 'foods', 'recipes', 'favoriteFoods', 'meals', 'dailyNutritionTargets', 'nutritionSettings'])
const versionOf = (record?: Record<string, unknown>) => typeof record?.version === 'number' ? record.version : 0

export interface BootstrapResult { workspace: LocalWorkspace; pulled: number; pushed: number; localUserId?: string }

export class SyncService {
  private readonly queue: SyncQueue
  private readonly resolver = new ConflictResolver()
  constructor(private readonly db: FormdaDatabase = appDb, private readonly adapter: CloudAdapter = firebaseAdapter) { this.queue = new SyncQueue(db) }
  get configured() { return this.adapter.configured }
  onAuthStateChanged(callback: (identity?: AuthIdentity) => void) { return this.adapter.onAuthStateChanged(callback) }
  createAccount(email: string, password: string) { return this.adapter.createAccount(email, password) }
  signIn(email: string, password: string) { return this.adapter.signIn(email, password) }

  async enable(userId: string, identity: AuthIdentity, workspaceId?: string) {
    if (!identity.emailVerified) {
      await this.setGatePreference(userId, identity, 'verification_required')
      throw new Error('EMAIL_VERIFICATION_REQUIRED')
    }
    const current = await this.getPreference(userId)
    const now = new Date().toISOString()
    const preference = cloudSyncPreferenceSchema.parse(current ? {
      ...current, enabled: true, cloudUserId: identity.uid, email: identity.email, syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: undefined, updatedAt: now, version: current.version + 1,
    } : {
      ...createEntityMetadata(now), userId, enabled: true, cloudUserId: identity.uid, email: identity.email, clientId: crypto.randomUUID(), syncStatus: navigator.onLine ? 'pending' : 'offline',
    })
    await this.db.cloudSyncPreferences.put(preference)
    if (navigator.onLine) await this.syncNow(userId, workspaceId)
    return preference
  }

  async bootstrap(workspace: LocalWorkspace, identity: AuthIdentity): Promise<BootstrapResult> {
    if (!identity.emailVerified) {
      if (workspace.localUserId) await this.setGatePreference(workspace.localUserId, identity, 'verification_required')
      return { workspace, pulled: 0, pushed: 0, localUserId: workspace.localUserId }
    }
    if (!navigator.onLine) return { workspace, pulled: 0, pushed: 0, localUserId: workspace.localUserId }
    const cloud = await this.adapter.listRecords(identity.uid)
    this.validateCloudDataset(cloud, identity.uid)
    const cloudLocalUserIds = new Set(cloud.map((record) => record.localUserId))
    if (cloudLocalUserIds.size > 1) throw new Error('CLOUD_DATASET_OWNERSHIP_AMBIGUOUS')
    const cloudLocalUserId = [...cloudLocalUserIds][0]
    if (workspace.localUserId && cloudLocalUserId && workspace.localUserId !== cloudLocalUserId) throw new Error('CLOUD_DATASET_OWNERSHIP_MISMATCH')
    const localUserId = workspace.localUserId ?? cloudLocalUserId
    let resolvedWorkspace = workspace
    if (localUserId && !workspace.localUserId) {
      resolvedWorkspace = { ...workspace, localUserId, updatedAt: new Date().toISOString(), version: workspace.version + 1 }
      await this.db.localWorkspaces.put(resolvedWorkspace)
    }
    if (!localUserId) return { workspace: resolvedWorkspace, pulled: 0, pushed: 0 }
    await this.ensurePreference(localUserId, identity)
    let pulled = 0
    for (const remote of [...cloud].sort((left, right) => (RESTORE_ORDER.get(left.entityType) ?? 999) - (RESTORE_ORDER.get(right.entityType) ?? 999))) {
      if (await this.applyRemote(remote, localUserId, resolvedWorkspace.id)) pulled += 1
    }
    const result = await this.syncNow(localUserId, resolvedWorkspace.id)
    return { workspace: resolvedWorkspace, pulled: pulled + result.pulled, pushed: result.pushed, localUserId }
  }

  async inspectCloudOwner(identity: AuthIdentity) {
    if (!identity.emailVerified || !navigator.onLine) return undefined
    const records = await this.adapter.listRecords(identity.uid)
    this.validateCloudDataset(records, identity.uid)
    const owners = new Set(records.map((record) => record.localUserId))
    if (owners.size > 1) throw new Error('CLOUD_DATASET_OWNERSHIP_AMBIGUOUS')
    return [...owners][0]
  }

  async pause(userId: string, status: 'authentication_required' | 'verification_required' | 'disabled' = 'authentication_required') {
    const current = await this.getPreference(userId)
    if (current) await this.updatePreference(current, { enabled: false, syncStatus: status, syncError: undefined })
  }

  async signOut(userId: string) {
    await this.adapter.signOut()
    await this.pause(userId)
  }

  async deleteCloudData(userId: string, identity?: AuthIdentity) {
    const preference = await this.getPreference(userId)
    if (!preference?.cloudUserId) throw new Error('CLOUD_SYNC_DISABLED')
    if (identity && preference.cloudUserId !== identity.uid) throw new Error('WORKSPACE_AUTH_MISMATCH')
    return this.adapter.deleteAllUserData(preference.cloudUserId)
  }

  async getPreference(userId: string) { return this.db.cloudSyncPreferences.where('userId').equals(userId).first() }

  async syncNow(userId: string, workspaceId?: string) {
    const preference = await this.requireEnabled(userId)
    if (!navigator.onLine) { await this.updatePreference(preference, { syncStatus: 'offline' }); return { pushed: 0, pulled: 0 } }
    await this.updatePreference(preference, { syncStatus: 'syncing', syncError: undefined })
    try {
      await this.enqueueLocalSnapshot(userId)
      const cloud = await this.adapter.listRecords(preference.cloudUserId!)
      this.validateCloudDataset(cloud, preference.cloudUserId!, userId)
      let pulled = 0
      const effectiveWorkspaceId = workspaceId ?? (await this.db.localWorkspaces.where('localUserId').equals(userId).first())?.id ?? 'legacy-workspace'
      for (const remote of [...cloud].sort((left, right) => (RESTORE_ORDER.get(left.entityType) ?? 999) - (RESTORE_ORDER.get(right.entityType) ?? 999))) {
        if (await this.applyRemote(remote, userId, effectiveWorkspaceId)) pulled += 1
      }
      const events = await this.queue.listReady(userId)
      let pushed = 0
      for (const event of events) {
        await this.db.syncOutbox.update(event.id, { status: 'syncing', updatedAt: new Date().toISOString() })
        const record: CloudRecord = {
          id: `${event.entityType}__${event.entityId}`, userId: preference.cloudUserId!, localUserId: userId,
          entityType: event.entityType, entityId: event.entityId, operation: event.operation, payload: event.payload,
          entityVersion: typeof event.payload.version === 'number' ? event.payload.version : 1,
          entityUpdatedAt: typeof event.payload.updatedAt === 'string' ? event.payload.updatedAt : event.updatedAt,
          clientId: preference.clientId, syncedAt: new Date().toISOString(),
        }
        try {
          await this.adapter.putRecord(preference.cloudUserId!, record)
          await this.db.syncOutbox.update(event.id, { status: 'synced', updatedAt: record.syncedAt, lastErrorCode: undefined })
          pushed += 1
        } catch (error) {
          const attempts = event.attempts + 1
          const retryAt = new Date(Date.now() + Math.min(15 * 60_000, 1_000 * 2 ** attempts)).toISOString()
          await this.db.syncOutbox.update(event.id, { status: 'error', attempts, nextAttemptAt: retryAt, lastErrorCode: this.errorCode(error), updatedAt: new Date().toISOString() })
          throw error
        }
      }
      const completedAt = new Date().toISOString()
      await this.updatePreference(await this.requireEnabled(userId), { syncStatus: 'synced', lastSyncedAt: completedAt, lastPulledAt: completedAt, syncError: undefined })
      return { pushed, pulled }
    } catch (error) {
      const latest = await this.getPreference(userId)
      if (latest?.enabled) await this.updatePreference(latest, { syncStatus: this.isAuthError(error) ? 'authentication_required' : 'error', enabled: !this.isAuthError(error), syncError: this.errorCode(error) })
      throw error
    }
  }

  async enqueueLocalSnapshot(userId: string) {
    const records = await this.localRecords(userId)
    for (const [entityType, entities] of records) for (const entity of entities) await this.queue.enqueue(userId, entityType, entity)
    return records.reduce((count, [, entities]) => count + entities.length, 0)
  }

  private async ensurePreference(userId: string, identity: AuthIdentity) {
    const current = await this.getPreference(userId)
    if (current) {
      if (current.cloudUserId && current.cloudUserId !== identity.uid) throw new Error('WORKSPACE_AUTH_MISMATCH')
      await this.updatePreference(current, { enabled: true, cloudUserId: identity.uid, email: identity.email, syncStatus: 'pending', syncError: undefined })
      return
    }
    await this.db.cloudSyncPreferences.put(cloudSyncPreferenceSchema.parse({ ...createEntityMetadata(), userId, enabled: true, cloudUserId: identity.uid, email: identity.email, clientId: crypto.randomUUID(), syncStatus: 'pending' }))
  }

  private async setGatePreference(userId: string, identity: AuthIdentity, status: 'verification_required' | 'authentication_required') {
    const current = await this.getPreference(userId)
    const value = current ? { ...current, enabled: false, cloudUserId: identity.uid, email: identity.email, syncStatus: status, updatedAt: new Date().toISOString(), version: current.version + 1 }
      : { ...createEntityMetadata(), userId, enabled: false, cloudUserId: identity.uid, email: identity.email, clientId: crypto.randomUUID(), syncStatus: status }
    await this.db.cloudSyncPreferences.put(cloudSyncPreferenceSchema.parse(value))
  }

  private validateCloudDataset(records: CloudRecord[], authUid: string, expectedLocalUserId?: string) {
    for (const record of records) {
      if (record.userId !== authUid) throw new Error('CLOUD_ENVELOPE_OWNER_MISMATCH')
      if (expectedLocalUserId && record.localUserId !== expectedLocalUserId) throw new Error('CLOUD_LOCAL_OWNER_MISMATCH')
      if (record.id !== `${record.entityType}__${record.entityId}` || !SYNCABLE_ENTITY_TYPES.includes(record.entityType)) throw new Error('CLOUD_ENVELOPE_INVALID')
      if (directUserTables.has(record.entityType)) {
        const payloadOwner = record.entityType === 'userProfiles' ? record.payload.id : record.payload.userId
        if (payloadOwner !== record.localUserId) throw new Error('CLOUD_PAYLOAD_OWNER_MISMATCH')
      }
    }
  }

  private async localRecords(userId: string): Promise<Array<[SyncEntityType, Array<EntityMetadata & Record<string, unknown>>]>> {
    const output: Array<[SyncEntityType, Array<EntityMetadata & Record<string, unknown>>]> = []
    for (const entityType of SYNCABLE_ENTITY_TYPES) {
      let records: unknown[] = []
      if (directUserTables.has(entityType)) {
        if (entityType === 'userProfiles') { const profile = await this.db.userProfiles.get(userId); records = profile ? [profile] : [] }
        else records = await this.db.table(entityType).where('userId').equals(userId).toArray()
      } else if (entityType === 'workoutDays') {
        const planIds = await this.db.workoutPlans.where('userId').equals(userId).primaryKeys()
        records = planIds.length ? await this.db.workoutDays.where('workoutPlanId').anyOf(planIds).toArray() : []
      } else if (entityType === 'workoutExercises') {
        const planIds = await this.db.workoutPlans.where('userId').equals(userId).primaryKeys()
        const dayIds = planIds.length ? await this.db.workoutDays.where('workoutPlanId').anyOf(planIds).primaryKeys() : []
        records = dayIds.length ? await this.db.workoutExercises.where('workoutDayId').anyOf(dayIds).toArray() : []
      } else if (entityType === 'workoutSets') {
        const sessionIds = await this.db.workoutSessions.where('userId').equals(userId).primaryKeys()
        records = sessionIds.length ? await this.db.workoutSets.where('workoutSessionId').anyOf(sessionIds).toArray() : []
      } else if (entityType === 'recipeIngredients') {
        const recipeIds = await this.db.recipes.where('userId').equals(userId).primaryKeys()
        records = recipeIds.length ? await this.db.recipeIngredients.where('recipeId').anyOf(recipeIds).toArray() : []
      } else if (entityType === 'mealItems') {
        const mealIds = await this.db.meals.where('userId').equals(userId).primaryKeys()
        records = mealIds.length ? await this.db.mealItems.where('mealId').anyOf(mealIds).toArray() : []
      }
      output.push([entityType, records as Array<EntityMetadata & Record<string, unknown>>])
    }
    return output
  }

  private async applyRemote(remote: CloudRecord, localUserId: string, workspaceId: string) {
    const table = this.db.table(remote.entityType)
    const local = await table.get(remote.entityId) as Record<string, unknown> | undefined
    const resolution = this.resolver.resolve(remote.entityType, local, remote.payload)
    if (local && resolution.reason !== 'equal') {
      const now = new Date().toISOString()
      const audit: SyncConflictAudit = {
        ...createEntityMetadata(now), workspaceId, localUserId, entityType: remote.entityType, entityId: remote.entityId,
        localVersion: versionOf(local), remoteVersion: versionOf(remote.payload), winner: resolution.winner, reason: resolution.reason, resolvedAt: now,
      }
      await this.db.syncConflictAudits.add(audit)
    }
    if (resolution.winner !== 'remote') return false
    await table.put(resolution.record)
    await this.db.syncOutbox.filter((event) => event.userId === localUserId && event.entityId === remote.entityId && event.entityType === remote.entityType && event.status !== 'synced').modify({ status: 'synced', updatedAt: new Date().toISOString(), lastErrorCode: undefined })
    return true
  }

  private async requireEnabled(userId: string) {
    const preference = await this.getPreference(userId)
    if (!preference?.enabled || !preference.cloudUserId) throw new Error('CLOUD_SYNC_DISABLED')
    return preference
  }

  private async updatePreference(current: CloudSyncPreference, changes: Partial<CloudSyncPreference>) {
    await this.db.cloudSyncPreferences.put({ ...current, ...changes, updatedAt: new Date().toISOString(), version: current.version + 1 })
  }

  private isAuthError(error: unknown) { return this.errorCode(error).startsWith('auth/') || this.errorCode(error) === 'permission-denied' }
  private errorCode(error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') return error.code.slice(0, 80)
    return error instanceof Error ? error.message.slice(0, 80) : 'SYNC_FAILED'
  }
}
