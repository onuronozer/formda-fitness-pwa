import { DAILY_GOAL_CONFIG, WALKING_BEGINNER_PROTOCOL_ID } from '../config/phase3b'
import { appDb, type FormdaDatabase } from '../db/database'
import type { HealthGateStatus } from '../domain/enums'
import { createEntityMetadata, type DailyGoalPlan, type DailyGoalSettings } from '../domain/models'
import { DailyGoalEngine } from '../rules/goals'
import { SyncQueue } from '../sync/SyncQueue'
import { shiftLocalDate, toLocalDate } from '../utils/localDate'
import { dailyGoalPlanSchema, dailyGoalSettingsSchema } from '../validation/phase3bSchemas'
import { WaterService } from './WaterService'

export class DailyGoalService {
  private readonly engine = new DailyGoalEngine()
  private readonly water: WaterService
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.water = new WaterService(db); this.queue = new SyncQueue(db) }

  async getSettings(userId: string) {
    const existing = await this.db.dailyGoalSettings.where('userId').equals(userId).first()
    if (existing) return existing
    const settings = dailyGoalSettingsSchema.parse({ ...createEntityMetadata(), id: userId, userId, stepMode: 'adaptive', currentStepBaseline: DAILY_GOAL_CONFIG.defaultStepBaseline, hydrationMode: 'program' })
    await this.db.transaction('rw', [this.db.dailyGoalSettings, this.db.syncOutbox], async () => {
      await this.db.dailyGoalSettings.put(settings)
      await this.queue.enqueue(userId, 'dailyGoalSettings', settings as DailyGoalSettings & Record<string, unknown>)
    })
    return settings
  }

  async updateSettings(userId: string, changes: Pick<DailyGoalSettings, 'stepMode' | 'manualStepTarget' | 'hydrationMode' | 'manualHydrationTargetMl'>) {
    const current = await this.getSettings(userId)
    const updated = dailyGoalSettingsSchema.parse({ ...current, ...changes, updatedAt: new Date().toISOString(), version: current.version + 1 })
    await this.db.transaction('rw', [this.db.dailyGoalSettings, this.db.syncOutbox], async () => {
      await this.db.dailyGoalSettings.put(updated)
      await this.queue.enqueue(userId, 'dailyGoalSettings', updated as DailyGoalSettings & Record<string, unknown>)
    })
    return updated
  }

  async getPlan(userId: string, localDate: string) { return this.db.dailyGoalPlans.where('[userId+localDate]').equals([userId, localDate]).first() }

  async getOrCreate(userId: string, localDate: string, healthStatus: HealthGateStatus, workoutDayId?: string) {
    const existing = await this.getPlan(userId, localDate)
    if (existing && localDate !== toLocalDate(new Date())) return existing
    const settings = await this.getSettings(userId)
    const hydration = await this.water.getOrCreateTarget(userId, localDate, settings)
    const recent = await this.db.stepRecords.where('[userId+localDate]').between([userId, shiftLocalDate(localDate, -DAILY_GOAL_CONFIG.recentDays)], [userId, shiftLocalDate(localDate, -1)], true, true).filter((record) => !record.deletedAt).toArray()
    const dailySteps = [...recent.reduce((map, record) => map.set(record.localDate, (map.get(record.localDate) ?? 0) + record.stepCount), new Map<string, number>())].map(([date, steps]) => ({ localDate: date, steps }))
    const protocol = await this.db.intervalProtocols.get(WALKING_BEGINNER_PROTOCOL_ID)
    const candidate = this.engine.generate({ userId, localDate, healthStatus, recentSteps: dailySteps, settings, hydrationTargetMl: hydration.targetMl, workoutDayId, intervalProtocolId: protocol?.active ? protocol.id : undefined, previousTodayPlan: existing })
    if (existing && this.samePlan(existing, candidate)) return existing
    const plan = dailyGoalPlanSchema.parse(existing
      ? { ...existing, ...candidate, createdAt: existing.createdAt, updatedAt: candidate.generatedAt, version: existing.version + 1 }
      : { ...createEntityMetadata(candidate.generatedAt), ...candidate })
    await this.db.transaction('rw', [this.db.dailyGoalPlans, this.db.syncOutbox], async () => {
      await this.db.dailyGoalPlans.put(plan)
      await this.queue.enqueue(userId, 'dailyGoalPlans', plan as DailyGoalPlan & Record<string, unknown>)
    })
    return plan
  }

  private samePlan(current: DailyGoalPlan, candidate: ReturnType<DailyGoalEngine['generate']>) {
    return current.hydrationTargetMl === candidate.hydrationTargetMl && current.stepTarget === candidate.stepTarget && current.workoutTarget === candidate.workoutTarget && current.workoutDayId === candidate.workoutDayId && current.cardioTarget === candidate.cardioTarget && current.intervalProtocolId === candidate.intervalProtocolId && current.healthStatusAtGeneration === candidate.healthStatusAtGeneration && current.reasons.join('|') === candidate.reasons.join('|')
  }
}
