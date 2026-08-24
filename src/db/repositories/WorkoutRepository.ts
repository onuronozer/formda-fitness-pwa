import type { WorkoutDay, WorkoutExercise, WorkoutPlan, WorkoutSession, WorkoutSet } from '../../domain/models'
import { appDb, type FormdaDatabase } from '../database'
import { SyncQueue } from '../../sync/SyncQueue'

export class WorkoutRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async savePlan(plan: WorkoutPlan, days: WorkoutDay[], exercises: WorkoutExercise[]) {
    await this.db.transaction('rw', [this.db.workoutPlans, this.db.workoutDays, this.db.workoutExercises, this.db.syncOutbox], async () => {
      const active = await this.db.workoutPlans.where('userId').equals(plan.userId).filter((item) => item.active).toArray()
      for (const previous of active) {
        const retired = { ...previous, active: false, updatedAt: new Date().toISOString(), version: previous.version + 1 }
        await this.db.workoutPlans.put(retired); await this.queue.enqueue(plan.userId, 'workoutPlans', retired as WorkoutPlan & Record<string, unknown>)
      }
      await this.db.workoutPlans.add(plan)
      await this.db.workoutDays.bulkAdd(days)
      await this.db.workoutExercises.bulkAdd(exercises)
      await this.queue.enqueue(plan.userId, 'workoutPlans', plan as WorkoutPlan & Record<string, unknown>)
      for (const day of days) await this.queue.enqueue(plan.userId, 'workoutDays', day as WorkoutDay & Record<string, unknown>)
      for (const exercise of exercises) await this.queue.enqueue(plan.userId, 'workoutExercises', exercise as WorkoutExercise & Record<string, unknown>)
    })
    return plan
  }

  async getActivePlan(userId: string) { return (await this.db.workoutPlans.where('userId').equals(userId).filter((item) => item.active).sortBy('createdAt')).at(-1) }
  async listDays(workoutPlanId: string) { return this.db.workoutDays.where('workoutPlanId').equals(workoutPlanId).sortBy('dayIndex') }
  async listDayExercises(workoutDayId: string) { return this.db.workoutExercises.where('workoutDayId').equals(workoutDayId).sortBy('order') }
  async getDay(id: string) { return this.db.workoutDays.get(id) }
  async getPlan(id: string) { return this.db.workoutPlans.get(id) }

  async addSession(session: WorkoutSession) { await this.db.transaction('rw', [this.db.workoutSessions, this.db.syncOutbox], async () => { await this.db.workoutSessions.add(session); await this.queue.enqueue(session.userId, 'workoutSessions', session as WorkoutSession & Record<string, unknown>) }); return session }
  async getSession(id: string) { return this.db.workoutSessions.get(id) }
  async listSessions(userId: string) { return this.db.workoutSessions.where('userId').equals(userId).sortBy('startedAt') }
  async getLatestSessionForDay(userId: string, localDate: string, workoutDayId: string) {
    return (await this.db.workoutSessions.where('[userId+localDate]').equals([userId, localDate]).sortBy('startedAt')).filter((session) => session.workoutDayId === workoutDayId).at(-1)
  }
  async updateSession(id: string, changes: Partial<Pick<WorkoutSession, 'status' | 'completedAt' | 'preWorkoutCheckId'>>) {
    const current = await this.db.workoutSessions.get(id)
    if (!current) throw new Error('Antrenman oturumu bulunamadı.')
    const updated = { ...current, ...changes, updatedAt: new Date().toISOString(), version: current.version + 1 }
    await this.db.transaction('rw', [this.db.workoutSessions, this.db.syncOutbox], async () => { await this.db.workoutSessions.put(updated); await this.queue.enqueue(updated.userId, 'workoutSessions', updated as WorkoutSession & Record<string, unknown>) })
    return updated
  }

  async upsertSet(record: WorkoutSet) {
    const existing = await this.db.workoutSets.where('[workoutSessionId+exerciseId+setNumber]').equals([record.workoutSessionId, record.exerciseId, record.setNumber]).first()
    const saved = existing ? { ...existing, ...record, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString(), version: existing.version + 1 } : record
    const session = await this.db.workoutSessions.get(record.workoutSessionId)
    if (!session) throw new Error('Antrenman oturumu bulunamadı.')
    await this.db.transaction('rw', [this.db.workoutSets, this.db.syncOutbox], async () => { await this.db.workoutSets.put(saved); await this.queue.enqueue(session.userId, 'workoutSets', saved as WorkoutSet & Record<string, unknown>) })
    return saved
  }
  async listSets(workoutSessionId: string) { return this.db.workoutSets.where('workoutSessionId').equals(workoutSessionId).toArray() }
}
