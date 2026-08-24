import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEntityMetadata } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { NutritionRepository, UserRepository, WorkoutRepository } from '../db/repositories'
import { AccountService } from '../services/AccountService'
import { AuthService, useAuthStore } from '../services/AuthService'
import { DailyHealthService } from '../services/DailyHealthService'
import { MealService } from '../services/MealService'
import { NutritionTargetService } from '../services/NutritionTargetService'
import { WaterService } from '../services/WaterService'
import { WorkoutService } from '../services/WorkoutService'
import { WorkspaceService } from '../services/WorkspaceService'
import { SyncService } from '../sync'
import { USER_ID, validProfile } from './fixtures'
import { MemoryCloudAdapter } from './MemoryCloudAdapter'

const names: string[] = []
const createDb = () => { const name = `formda-phase4-flow-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
beforeEach(() => useAuthStore.setState({ status: 'loading', identity: undefined, error: undefined }))
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

function client(db: FormdaDatabase, cloud: MemoryCloudAdapter) {
  const auth = new AuthService(cloud); const sync = new SyncService(db, cloud)
  return { account: new AccountService(db, auth, sync), sync }
}

describe('Phase 4 real user flow', () => {
  it('restores breakfast, lunch recipe, water, target and completed workout on a fresh client', async () => {
    const date = '2026-08-24'; const email = 'daily-flow@example.test'; const cloud = new MemoryCloudAdapter(undefined, true)
    const firstDb = createDb(); const first = client(firstDb, cloud); const created = await first.account.createAccount(email, 'StrongPass123!')
    await new UserRepository(firstDb).save({ ...validProfile, sex: 'male' })
    await new WorkspaceService(firstDb).attachLocalUser(created.workspace.id, USER_ID)
    await first.account.refreshVerification()

    const nutrition = new NutritionRepository(firstDb); const meals = new MealService(firstDb)
    const egg = (await nutrition.searchFoods(USER_ID, { query: 'yumurta' }))[0]
    const cheese = (await nutrition.searchFoods(USER_ID, { query: 'peynir' }))[0]
    const bread = (await nutrition.searchFoods(USER_ID, { query: 'ekmek' }))[0]
    const lunch = (await nutrition.listRecipes(USER_ID, 'mercimek corbasi'))[0]
    expect([egg, cheese, bread, lunch].every(Boolean)).toBe(true)
    const eggGrams = (egg.servingDefinitions[0]?.grams ?? 50) * 2
    await meals.addFood(USER_ID, date, 'BREAKFAST', egg.id, eggGrams)
    await meals.addFood(USER_ID, date, 'BREAKFAST', cheese.id, 60)
    await meals.addFood(USER_ID, date, 'BREAKFAST', bread.id, 80)
    await meals.addRecipe(USER_ID, date, 'LUNCH', lunch.id, { servings: 1 })
    await new WaterService(firstDb).addShortcut(USER_ID, 250, 'phase4-flow-water', `${date}T09:00:00.000Z`)
    await new NutritionTargetService(firstDb).getOrCreate(USER_ID, date)

    const now = `${date}T10:00:00.000Z`; const dayId = crypto.randomUUID()
    const plan = { ...createEntityMetadata(now), userId: USER_ID, name: 'Full Body A', goal: 'maintain' as const, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL' as const, active: true, generatedByRuleVersion: 2, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: now }
    await new WorkoutRepository(firstDb).savePlan(plan, [{ ...createEntityMetadata(now), id: dayId, workoutPlanId: plan.id, dayIndex: 0, scheduledWeekday: 1, name: 'Gün 1' }], [])
    const health = new DailyHealthService(firstDb); const daily = await health.saveDailyCheck(USER_ID, { localDate: date, overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: [] })
    const preWorkout = await health.createPreWorkout(USER_ID, { localDate: date, dailyHealthCheckId: daily.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false })
    const workouts = new WorkoutService(firstDb); const session = await workouts.startSession(USER_ID, dayId, date, preWorkout.log.id, preWorkout.check.id)
    await workouts.completeSession(session.id)
    await first.sync.syncNow(USER_ID)
    await first.account.signOut(); firstDb.close()

    const restoredDb = createDb(); const restored = client(restoredDb, cloud); await restored.account.signIn(email, 'StrongPass123!')
    const restoredMeals = new MealService(restoredDb); const day = await restoredMeals.getDay(USER_ID, date)
    expect(day.flatMap((entry) => entry.items)).toHaveLength(4)
    expect((await restoredMeals.getDailyTotal(USER_ID, date)).nutrients.energyKcal).toBeGreaterThan(0)
    expect(await new WaterService(restoredDb).getDailyTotal(USER_ID, date)).toBe(250)
    expect((await restoredDb.dailyNutritionTargets.where('[userId+localDate]').equals([USER_ID, date]).first())?.ruleVersion).toBe(2)
    expect((await restoredDb.workoutSessions.where('userId').equals(USER_ID).first())?.status).toBe('completed')
    restoredDb.close()
  })
})
