import { createEntityMetadata, type NutritionActivityLevel, type NutritionSettings } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'
import { UserRepository } from '../db/repositories'
import { NutritionTargetEngine } from '../rules/nutrition'
import { SyncQueue } from '../sync'
import { dailyNutritionTargetSchema, nutritionSettingsSchema } from '../validation/nutritionSchemas'

const activityFromTrainingDays = (days: number): NutritionActivityLevel => days >= 4 ? 'high' : days === 3 ? 'moderate' : days === 2 ? 'light' : 'sedentary'

export class NutritionTargetService {
  private readonly users: UserRepository
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb, private readonly engine = new NutritionTargetEngine()) { this.users = new UserRepository(db); this.queue = new SyncQueue(db) }

  async get(userId: string, localDate: string) { return this.db.dailyNutritionTargets.where('[userId+localDate]').equals([userId, localDate]).first() }

  async getOrCreate(userId: string, localDate: string) {
    const existing = await this.get(userId, localDate)
    if (existing) return existing
    const profile = await this.users.getById(userId)
    if (!profile) return undefined
    const settings = await this.getSettings(userId)
    const hypertension = Boolean(await this.db.healthConditions.where('userId').equals(userId).filter((condition) => condition.active && !condition.deletedAt && condition.conditionType === 'hypertension').first())
    const result = this.engine.generate(profile, settings, localDate, hypertension)
    if (!result.target) return undefined
    const target = dailyNutritionTargetSchema.parse(result.target)
    await this.db.transaction('rw', [this.db.dailyNutritionTargets, this.db.syncOutbox], async () => { await this.db.dailyNutritionTargets.add(target); await this.queue.enqueue(userId, 'dailyNutritionTargets', target as typeof target & Record<string, unknown>) })
    return target
  }

  async getSettings(userId: string) {
    const existing = await this.db.nutritionSettings.where('userId').equals(userId).first()
    if (existing) return existing
    const profile = await this.users.getById(userId)
    if (!profile) throw new Error('PROFILE_REQUIRED')
    const settings = nutritionSettingsSchema.parse({ ...createEntityMetadata(), userId, activityLevel: activityFromTrainingDays(profile.trainingDaysPerWeek) }) as NutritionSettings
    await this.db.transaction('rw', [this.db.nutritionSettings, this.db.syncOutbox], async () => { await this.db.nutritionSettings.add(settings); await this.queue.enqueue(userId, 'nutritionSettings', settings as NutritionSettings & Record<string, unknown>) })
    return settings
  }

  async updateSettings(userId: string, changes: Partial<Omit<NutritionSettings, keyof ReturnType<typeof createEntityMetadata> | 'userId'>>) {
    const current = await this.getSettings(userId)
    const settings = nutritionSettingsSchema.parse({ ...current, ...changes, updatedAt: new Date().toISOString(), version: current.version + 1 }) as NutritionSettings
    await this.db.transaction('rw', [this.db.nutritionSettings, this.db.syncOutbox], async () => { await this.db.nutritionSettings.put(settings); await this.queue.enqueue(userId, 'nutritionSettings', settings as NutritionSettings & Record<string, unknown>) })
    return settings
  }
}
