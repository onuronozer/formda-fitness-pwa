import { HYDRATION_CONFIG, HYDRATION_PROGRAM_VERSION } from '../config/phase3b'
import type { WaterSource } from '../domain/enums'
import { createEntityMetadata, type DailyGoalSettings } from '../domain/models'
import { WaterRepository } from '../db/repositories'
import { appDb, type FormdaDatabase } from '../db/database'
import { toLocalDate } from '../utils/localDate'
import { hydrationTargetAmountSchema, waterAmountSchema } from '../validation/phase3bSchemas'

export class WaterService {
  private readonly repository: WaterRepository
  constructor(db: FormdaDatabase = appDb) { this.repository = new WaterRepository(db) }

  async add(userId: string, amount: unknown, source: WaterSource = 'manual', consumedAt = new Date().toISOString()) {
    const amountMl = waterAmountSchema.parse(amount)
    return this.repository.add({ ...createEntityMetadata(consumedAt), userId, amountMl, consumedAt, localDate: toLocalDate(consumedAt), source })
  }

  async addShortcut(userId: string, amount: unknown, actionId: string, consumedAt = new Date().toISOString()) {
    const amountMl = waterAmountSchema.parse(amount)
    return this.repository.addFromShortcut({ ...createEntityMetadata(consumedAt), userId, amountMl, consumedAt, localDate: toLocalDate(consumedAt), source: 'shortcut' }, actionId)
  }

  async update(id: string, amount: unknown, consumedAt: string) {
    return this.repository.update(id, waterAmountSchema.parse(amount), consumedAt, toLocalDate(consumedAt))
  }

  async remove(id: string) { return this.repository.remove(id) }
  async listForDate(userId: string, localDate: string) { return this.repository.listForDate(userId, localDate) }
  async getDailyTotal(userId: string, localDate: string) { return this.repository.totalForDate(userId, localDate) }

  async getOrCreateTarget(userId: string, localDate: string, settings?: DailyGoalSettings) {
    const existing = await this.repository.getTarget(userId, localDate)
    if (existing) return existing
    const source = settings?.hydrationMode === 'manual' ? 'manual' as const : settings?.hydrationMode === 'fluid_restriction' ? 'fluid_restriction' as const : 'program' as const
    const targetMl = source === 'manual' ? hydrationTargetAmountSchema.parse(settings?.manualHydrationTargetMl) : HYDRATION_CONFIG.targetMl.default
    return this.repository.putTarget({ ...createEntityMetadata(), userId, localDate, targetMl, source, ruleVersion: HYDRATION_PROGRAM_VERSION })
  }

  async overrideTarget(userId: string, localDate: string, target: unknown) {
    const targetMl = hydrationTargetAmountSchema.parse(target)
    const current = await this.repository.getTarget(userId, localDate)
    return this.repository.putTarget(current
      ? { ...current, targetMl, source: 'manual', updatedAt: new Date().toISOString(), version: current.version + 1 }
      : { ...createEntityMetadata(), userId, localDate, targetMl, source: 'manual', ruleVersion: HYDRATION_PROGRAM_VERSION })
  }
}
