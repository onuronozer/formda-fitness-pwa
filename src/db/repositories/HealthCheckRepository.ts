import type { DailyHealthCheck, DailyHealthResponse, PreWorkoutCheck } from '../../domain/models'
import { appDb, type FormdaDatabase } from '../database'
import { SyncQueue } from '../../sync/SyncQueue'

export class HealthCheckRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async saveDailyRevision(check: DailyHealthCheck, responses: DailyHealthResponse[]) {
    await this.db.transaction('rw', [this.db.dailyHealthChecks, this.db.dailyHealthResponses, this.db.syncOutbox], async () => {
      await this.db.dailyHealthChecks.add(check)
      if (responses.length) await this.db.dailyHealthResponses.bulkAdd(responses)
      await this.queue.enqueue(check.userId, 'dailyHealthChecks', check as DailyHealthCheck & Record<string, unknown>)
      for (const response of responses) await this.queue.enqueue(response.userId, 'dailyHealthResponses', response as DailyHealthResponse & Record<string, unknown>)
    })
    return check
  }

  async getLatestDaily(userId: string, localDate: string) {
    const checks = await this.db.dailyHealthChecks.where('[userId+localDate]').equals([userId, localDate]).sortBy('revision')
    return checks.filter((check) => !check.deletedAt).at(-1)
  }

  async listDailyRevisions(userId: string, localDate: string) {
    return (await this.db.dailyHealthChecks.where('[userId+localDate]').equals([userId, localDate]).sortBy('revision')).filter((check) => !check.deletedAt)
  }

  async getResponses(healthCheckId: string) {
    return this.db.dailyHealthResponses.where('healthCheckId').equals(healthCheckId).filter((response) => !response.deletedAt).toArray()
  }

  async savePreWorkout(check: PreWorkoutCheck) {
    await this.db.transaction('rw', [this.db.preWorkoutChecks, this.db.syncOutbox], async () => { await this.db.preWorkoutChecks.add(check); await this.queue.enqueue(check.userId, 'preWorkoutChecks', check as PreWorkoutCheck & Record<string, unknown>) })
    return check
  }

  async getLatestPreWorkout(userId: string, localDate: string) {
    const checks = await this.db.preWorkoutChecks.where('[userId+localDate]').equals([userId, localDate]).sortBy('checkedAt')
    return checks.filter((check) => !check.deletedAt).at(-1)
  }
}
