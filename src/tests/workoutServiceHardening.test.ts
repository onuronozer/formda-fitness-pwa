import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type HealthEvaluationLog } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { UserRepository, WorkoutRepository } from '../db/repositories'
import { WorkoutService } from '../services/WorkoutService'
import type { WorkoutRuleEngine } from '../rules/workout'
import { validProfile } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-workout-hardening-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

const evaluation = (status: HealthEvaluationLog['status'] = 'NORMAL'): Pick<HealthEvaluationLog, 'status' | 'reasons' | 'triggeredRuleIds' | 'evaluatedAt' | 'rulesVersion' | 'debugEntries' | 'matchedRules' | 'attentionLevel'> => ({
  status, reasons: [], triggeredRuleIds: [], evaluatedAt: '2026-08-24T08:00:00.000Z', rulesVersion: 3, debugEntries: [], matchedRules: [], attentionLevel: status === 'NORMAL' ? 'ROUTINE' : 'MEDICAL_REVIEW',
})

describe('WorkoutService hardening', () => {
  it('persists only a validated plan with generation audit metadata', async () => {
    const db = new FormdaDatabase(testName()); await new UserRepository(db).save(validProfile)
    const result = await new WorkoutService(db).generatePlan(validProfile.id, evaluation())
    expect(result.validation).toMatchObject({ valid: true, errors: [] })
    expect(result.plan).toMatchObject({ generatedByRuleVersion: 2, validationResult: { valid: true } })
    expect(result.plan?.validatedAt).toBeTruthy()
    expect(await db.workoutPlans.count()).toBe(1)
    db.close()
  })

  it('does not persist an unsupported 5-day candidate', async () => {
    const db = new FormdaDatabase(testName()); await new UserRepository(db).save({ ...validProfile, trainingDaysPerWeek: 5 })
    const result = await new WorkoutService(db).generatePlan(validProfile.id, evaluation())
    expect(result.generated.reason).toBe('unsupported_training_days')
    expect(result.validation?.errors).toContain('UNSUPPORTED_TRAINING_DAYS')
    expect(await db.workoutPlans.count()).toBe(0)
    db.close()
  })

  it('does not persist a generator candidate that fails critical validation', async () => {
    const db = new FormdaDatabase(testName()); await new UserRepository(db).save(validProfile)
    const unsafeEngine = { generate: () => ({ allowed: true, status: 'NORMAL' as const, days: [0, 1, 2].map((index) => ({ name: `Gün ${index + 1}`, scheduledWeekday: index + 1, requiredMovementPatterns: [], exercises: [{ exerciseId: 'exercise-missing', targetSets: 3, targetRepMin: 8, targetRepMax: 12, targetRpe: 7, restSeconds: 90, modified: false }] })) }) } as WorkoutRuleEngine
    const result = await new WorkoutService(db, unsafeEngine).generatePlan(validProfile.id, evaluation())
    expect(result.validation?.errors).toContain('INVALID_EXERCISE_ID')
    expect(await db.workoutPlans.count()).toBe(0)
    db.close()
  })

  it('retains but does not expose a legacy plan without validation audit', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new WorkoutRepository(db)
    const plan = { ...createEntityMetadata(), userId: validProfile.id, name: 'Legacy', goal: 'maintain' as const, daysPerWeek: 3, healthStatusAtGeneration: 'NORMAL', active: true }
    await repository.savePlan(plan, [], [])
    expect(await new WorkoutService(db).getPlanOverview(validProfile.id)).toBeUndefined()
    expect(await db.workoutPlans.count()).toBe(1)
    db.close()
  })

  it('does not expose a persisted plan with a missing exercise reference', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new WorkoutRepository(db)
    const plan = { ...createEntityMetadata(), userId: validProfile.id, name: 'Broken', goal: 'maintain' as const, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL', active: true, generatedByRuleVersion: 2, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: new Date().toISOString() }
    const days = [0, 1].map((dayIndex) => ({ ...createEntityMetadata(), workoutPlanId: plan.id, dayIndex, scheduledWeekday: dayIndex + 1, name: `Gün ${dayIndex + 1}` }))
    const targets = days.map((day, order) => ({ ...createEntityMetadata(), workoutDayId: day.id, exerciseId: order === 0 ? 'exercise-missing' : 'exercise-bodyweight-squat', order: 0, targetSets: 3, targetRepMin: 8, targetRepMax: 12, targetRpe: 7, restSeconds: 90, modified: false }))
    await repository.savePlan(plan, days, targets)
    expect(await new WorkoutService(db).getPlanOverview(validProfile.id)).toBeUndefined()
    db.close()
  })

  it('rejects session creation without a pre-workout event', async () => {
    const db = new FormdaDatabase(testName()); const repository = new WorkoutRepository(db)
    const plan = { ...createEntityMetadata(), userId: validProfile.id, name: 'Validated', goal: 'maintain' as const, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL', active: true, generatedByRuleVersion: 2, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: new Date().toISOString() }
    const day = { ...createEntityMetadata(), workoutPlanId: plan.id, dayIndex: 0, scheduledWeekday: 1, name: 'Gün 1' }
    await repository.savePlan(plan, [day], [])
    await expect(new WorkoutService(db).startSession(validProfile.id, day.id, '2026-08-24', crypto.randomUUID())).rejects.toThrow('kontrol gerekli')
    expect(await db.workoutSessions.count()).toBe(0)
    db.close()
  })
})
