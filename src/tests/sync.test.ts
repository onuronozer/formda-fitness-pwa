import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { UserRepository } from '../db/repositories'
import { WaterService } from '../services/WaterService'
import { WorkspaceService } from '../services/WorkspaceService'
import { ConflictResolver, SyncQueue, SyncService, type AuthIdentity, type CloudAdapter, type CloudRecord } from '../sync'
import { USER_ID, validProfile } from './fixtures'

class MemoryCloudAdapter implements CloudAdapter {
  readonly configured = true
  records = new Map<string, CloudRecord>()
  failNext = false
  signedOut = false
  async onAuthStateChanged(callback: (identity?: AuthIdentity) => void) { callback({ uid: 'cloud-user-a', email: 'user@example.com', emailVerified: true }); return () => undefined }
  async createAccount(email: string) { return { uid: 'cloud-user-a', email, emailVerified: true } }
  async signIn(email: string) { return { uid: 'cloud-user-a', email, emailVerified: true } }
  async signOut() { this.signedOut = true }
  async sendPasswordReset() { return undefined }
  async sendVerification() { return undefined }
  async reloadIdentity() { return { uid: 'cloud-user-a', email: 'user@example.com', emailVerified: true } }
  async reauthenticate() { return { uid: 'cloud-user-a', email: 'user@example.com', emailVerified: true } }
  async deleteAccount() { return undefined }
  async putRecord(_userId: string, record: CloudRecord) { if (this.failNext) { this.failNext = false; throw new Error('network-failed') } this.records.set(record.id, structuredClone(record)) }
  async listRecords(userId: string) { return [...this.records.values()].filter((record) => record.userId === userId).map((record) => structuredClone(record)) }
  async deleteAllUserData(userId: string) { const records = await this.listRecords(userId); records.forEach((record) => this.records.delete(record.id)); return records.length }
}

const names: string[] = []
const create = () => { const name = `formda-sync-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
const identity = { uid: 'cloud-user-a', email: 'user@example.com', emailVerified: true }
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, value })
afterEach(async () => { setOnline(true); await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('local-first sync', () => {
  it('uploads the initial local snapshot idempotently', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud)
    await service.enable(USER_ID, identity); const firstSize = cloud.records.size
    await service.syncNow(USER_ID)
    expect(firstSize).toBeGreaterThan(0); expect(cloud.records.size).toBe(firstSize); expect((await db.syncOutbox.toArray()).every((event) => event.status === 'synced')).toBe(true); db.close()
  })

  it('downloads the cloud model to a second client', async () => {
    const cloud = new MemoryCloudAdapter(); const first = create(); await new UserRepository(first).save(validProfile); await new SyncService(first, cloud).enable(USER_ID, identity)
    const second = create(); await new SyncService(second, cloud).enable(USER_ID, identity)
    expect((await second.userProfiles.get(USER_ID))?.displayName).toBe('Deniz'); first.close(); second.close()
  })

  it('keeps an offline water write and syncs after reconnect', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud)
    setOnline(false); await service.enable(USER_ID, identity); await new WaterService(db).add(USER_ID, 250, 'quick_add', '2026-08-24T09:00:00.000Z')
    expect(cloud.records.size).toBe(0); setOnline(true); await service.syncNow(USER_ID)
    expect([...cloud.records.values()].some((record) => record.entityType === 'waterRecords')).toBe(true); db.close()
  })

  it('resolves a newer remote profile without overwriting it with a stale outbox event', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    const current = cloud.records.get(`userProfiles__${USER_ID}`)!
    cloud.records.set(current.id, { ...current, payload: { ...current.payload, displayName: 'Bulut Deniz', version: 2, updatedAt: '2026-08-25T08:00:00.000Z' }, entityVersion: 2, entityUpdatedAt: '2026-08-25T08:00:00.000Z' })
    await service.syncNow(USER_ID)
    expect((await db.userProfiles.get(USER_ID))?.displayName).toBe('Bulut Deniz'); expect(cloud.records.get(current.id)?.payload.displayName).toBe('Bulut Deniz'); db.close()
  })

  it('syncs a soft-delete tombstone', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    const water = new WaterService(db); const record = await water.add(USER_ID, 250); await service.syncNow(USER_ID); await water.remove(record.id); await service.syncNow(USER_ID)
    expect(cloud.records.get(`waterRecords__${record.id}`)?.operation).toBe('delete'); expect(cloud.records.get(`waterRecords__${record.id}`)?.payload.deletedAt).toBeTruthy(); db.close()
  })

  it('deduplicates identical outbox events', async () => {
    const db = create(); const queue = new SyncQueue(db); const entity = { ...validProfile, schemaVersion: 5 } as typeof validProfile & Record<string, unknown>
    await queue.enqueue(USER_ID, 'userProfiles', entity); await queue.enqueue(USER_ID, 'userProfiles', entity)
    expect(await db.syncOutbox.count()).toBe(1); db.close()
  })

  it('records a failed sync and retries it', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    await new WaterService(db).add(USER_ID, 330); cloud.failNext = true
    await expect(service.syncNow(USER_ID)).rejects.toThrow('network-failed')
    const failed = await db.syncOutbox.where('status').equals('error').first(); expect(failed?.attempts).toBe(1)
    await db.syncOutbox.update(failed!.id, { nextAttemptAt: '2026-01-01T00:00:00.000Z' }); await service.syncNow(USER_ID)
    expect((await db.syncOutbox.get(failed!.id))?.status).toBe('synced'); db.close()
  })

  it('sign-out leaves local health and fitness data intact', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity); await service.signOut(USER_ID)
    expect(cloud.signedOut).toBe(true); expect(await db.userProfiles.get(USER_ID)).toBeTruthy(); expect((await service.getPreference(USER_ID))?.syncStatus).toBe('authentication_required'); db.close()
  })

  it('uses explicit event and versioned conflict policies', () => {
    const resolver = new ConflictResolver(); const local = { id: 'a', version: 1, updatedAt: '2026-08-24T08:00:00.000Z' }; const remote = { ...local, version: 2, updatedAt: '2026-08-24T09:00:00.000Z' }
    expect(resolver.resolve('waterRecords', local, remote).winner).toBe('remote'); expect(resolver.resolve('userProfiles', remote, local).winner).toBe('local')
  })

  it('blocks cloud upload for an unverified email', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud)
    await expect(service.enable(USER_ID, { ...identity, emailVerified: false })).rejects.toThrow('EMAIL_VERIFICATION_REQUIRED')
    expect(cloud.records.size).toBe(0); expect((await service.getPreference(USER_ID))?.syncStatus).toBe('verification_required'); db.close()
  })

  it('bootstraps a fresh workspace and preserves workout relationships and historical goal snapshots', async () => {
    const cloud = new MemoryCloudAdapter(); const first = create(); await new UserRepository(first).save(validProfile)
    const now = '2026-08-24T08:00:00.000Z'; const metadata = (id: string) => ({ id, createdAt: now, updatedAt: now, version: 1, schemaVersion: 6 })
    const planId = '44444444-4444-4444-8444-444444444444'; const dayId = '55555555-5555-4555-8555-555555555555'; const workoutExerciseId = '66666666-6666-4666-8666-666666666666'; const sessionId = '77777777-7777-4777-8777-777777777777'; const setId = '88888888-8888-4888-8888-888888888888'
    await first.workoutPlans.put({ ...metadata(planId), userId: USER_ID, name: 'Plan', goal: 'weight_loss', active: true, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL', generatedByRuleVersion: 1, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: now })
    await first.workoutDays.put({ ...metadata(dayId), workoutPlanId: planId, dayIndex: 0, scheduledWeekday: 1, name: 'A' })
    await first.workoutExercises.put({ ...metadata(workoutExerciseId), workoutDayId: dayId, exerciseId: 'exercise-a', order: 0, targetSets: 3, targetRepMin: 8, targetRepMax: 12, targetRpe: 7, restSeconds: 90, modified: false })
    await first.workoutSessions.put({ ...metadata(sessionId), userId: USER_ID, workoutDayId: dayId, localDate: '2026-08-24', startedAt: now, healthEvaluationId: 'health-evaluation-a', status: 'completed' })
    await first.workoutSets.put({ ...metadata(setId), workoutSessionId: sessionId, exerciseId: 'exercise-a', setNumber: 1, reps: 10, weightKg: 20, completed: true })
    const goalId = '99999999-9999-4999-8999-999999999999'; await first.dailyGoalPlans.put({ ...metadata(goalId), userId: USER_ID, localDate: '2026-08-24', hydrationTargetMl: 2400, stepTarget: 6000, workoutTarget: 'workout', workoutDayId: dayId, cardioTarget: 'none', generatedByVersion: 1, healthStatusAtGeneration: 'NORMAL', reasons: ['snapshot'], generatedAt: now })
    await new SyncService(first, cloud).enable(USER_ID, identity)
    const second = create(); const workspace = (await new WorkspaceService(second).resolveAuthenticated(identity)).workspace
    await new SyncService(second, cloud).bootstrap(workspace, identity)
    expect((await new UserRepository(second).getActive())?.id).toBe(USER_ID)
    expect((await second.workoutDays.get(dayId))?.workoutPlanId).toBe(planId); expect((await second.workoutExercises.get(workoutExerciseId))?.workoutDayId).toBe(dayId)
    expect((await second.workoutSets.get(setId))?.workoutSessionId).toBe(sessionId); expect((await second.dailyGoalPlans.get(goalId))?.stepTarget).toBe(6000)
    first.close(); second.close()
  })

  it('uses a deterministic content tie-breaker and writes a conflict audit', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    const current = cloud.records.get(`userProfiles__${USER_ID}`)!
    cloud.records.set(current.id, { ...current, payload: { ...current.payload, displayName: 'Zeynep' } })
    await service.syncNow(USER_ID)
    const audit = await db.syncConflictAudits.where('entityId').equals(USER_ID).last()
    expect(audit?.reason).toBe('content_tiebreaker'); expect(['local', 'remote']).toContain(audit?.winner); db.close()
  })

  it('never resurrects a tombstone from a stale live update', () => {
    const resolver = new ConflictResolver(); const tombstone = { id: 'a', version: 2, updatedAt: '2026-08-24T09:00:00.000Z', deletedAt: '2026-08-24T09:00:00.000Z' }; const staleLive = { id: 'a', version: 99, updatedAt: '2026-08-25T09:00:00.000Z' }
    expect(resolver.resolve('waterRecords', tombstone, staleLive)).toMatchObject({ winner: 'local', reason: 'tombstone' })
    expect(resolver.resolve('waterRecords', staleLive, tombstone)).toMatchObject({ winner: 'remote', reason: 'tombstone' })
  })

  it('preserves concurrent append events with different IDs', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    const water = new WaterService(db); const first = await water.add(USER_ID, 250); await service.syncNow(USER_ID)
    const remote = cloud.records.get(`waterRecords__${first.id}`)!; const secondId = crypto.randomUUID()
    cloud.records.set(`waterRecords__${secondId}`, { ...remote, id: `waterRecords__${secondId}`, entityId: secondId, payload: { ...remote.payload, id: secondId, amountMl: 330 } })
    await service.syncNow(USER_ID)
    expect(await db.waterRecords.where('userId').equals(USER_ID).count()).toBe(2); db.close()
  })

  it('rejects a cloud envelope with the wrong authenticated owner', async () => {
    const db = create(); const cloud = new MemoryCloudAdapter(); await new UserRepository(db).save(validProfile); const service = new SyncService(db, cloud); await service.enable(USER_ID, identity)
    const current = cloud.records.get(`userProfiles__${USER_ID}`)!; cloud.listRecords = async () => [{ ...current, userId: 'cloud-user-b' }]
    await expect(service.syncNow(USER_ID)).rejects.toThrow('CLOUD_ENVELOPE_OWNER_MISMATCH'); expect(await db.userProfiles.get(USER_ID)).toBeTruthy(); db.close()
  })
})
