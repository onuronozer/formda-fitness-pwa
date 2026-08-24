import type { ConditionAnswer, HealthCondition, HealthEvaluationLog, HealthProfile } from '../../domain/models'
import { appDb, type FormdaDatabase } from '../database'
import { SyncQueue } from '../../sync/SyncQueue'

export interface HealthProfileBundle {
  profile: HealthProfile
  conditions: HealthCondition[]
  answers: ConditionAnswer[]
}

export class HealthProfileRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async getForUser(userId: string): Promise<HealthProfileBundle | undefined> {
    const profile = await this.db.healthProfiles.where('userId').equals(userId).filter((item) => !item.deletedAt).first()
    if (!profile) return undefined
    const conditions = await this.db.healthConditions.where('healthProfileId').equals(profile.id).filter((item) => !item.deletedAt).toArray()
    const conditionIds = new Set(conditions.map((condition) => condition.id))
    const answers = await this.db.conditionAnswers.where('userId').equals(userId).filter((answer) => conditionIds.has(answer.conditionId) && !answer.deletedAt).toArray()
    return { profile, conditions, answers }
  }

  async saveBundle(bundle: HealthProfileBundle): Promise<void> {
    await this.db.transaction('rw', this.db.healthProfiles, this.db.healthConditions, this.db.conditionAnswers, this.db.syncOutbox, async () => {
      await this.db.healthProfiles.put(bundle.profile)
      const now = new Date().toISOString()
      const oldConditions = await this.db.healthConditions.where('userId').equals(bundle.profile.userId).toArray()
      const oldAnswers = await this.db.conditionAnswers.where('userId').equals(bundle.profile.userId).toArray()
      const conditionIds = new Set(bundle.conditions.map((item) => item.id)); const answerIds = new Set(bundle.answers.map((item) => item.id))
      const retiredConditions = oldConditions.filter((item) => !conditionIds.has(item.id) && !item.deletedAt).map((item) => ({ ...item, deletedAt: now, updatedAt: now, version: item.version + 1 }))
      const retiredAnswers = oldAnswers.filter((item) => !answerIds.has(item.id) && !item.deletedAt).map((item) => ({ ...item, deletedAt: now, updatedAt: now, version: item.version + 1 }))
      if (retiredConditions.length) await this.db.healthConditions.bulkPut(retiredConditions)
      if (retiredAnswers.length) await this.db.conditionAnswers.bulkPut(retiredAnswers)
      if (bundle.conditions.length) await this.db.healthConditions.bulkPut(bundle.conditions)
      if (bundle.answers.length) await this.db.conditionAnswers.bulkPut(bundle.answers)
      await this.queue.enqueue(bundle.profile.userId, 'healthProfiles', bundle.profile as HealthProfile & Record<string, unknown>)
      for (const item of [...retiredConditions, ...bundle.conditions]) await this.queue.enqueue(bundle.profile.userId, 'healthConditions', item as HealthCondition & Record<string, unknown>)
      for (const item of [...retiredAnswers, ...bundle.answers]) await this.queue.enqueue(bundle.profile.userId, 'conditionAnswers', item as ConditionAnswer & Record<string, unknown>)
    })
  }

  async addEvaluationLog(log: HealthEvaluationLog): Promise<void> {
    await this.db.transaction('rw', [this.db.healthEvaluationLogs, this.db.syncOutbox], async () => { await this.db.healthEvaluationLogs.put(log); await this.queue.enqueue(log.userId, 'healthEvaluationLogs', log as HealthEvaluationLog & Record<string, unknown>) })
  }

  async getLatestEvaluation(userId: string): Promise<HealthEvaluationLog | undefined> {
    const items = await this.db.healthEvaluationLogs.where('userId').equals(userId).sortBy('evaluatedAt')
    return items.at(-1)
  }
}
