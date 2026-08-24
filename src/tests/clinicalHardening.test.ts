import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { HealthProfileRepository, WorkoutRepository } from '../db/repositories'
import { HealthRiskEngine } from '../rules/health'
import { DailyHealthService } from '../services/DailyHealthService'
import { WorkoutService } from '../services/WorkoutService'
import { condition, HEALTH_PROFILE_ID, USER_ID } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-clinical-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

const bpResponses = (systolic: number, diastolic: number, symptoms: Record<string, boolean> = {}) => [
  { conditionType: 'hypertension' as const, questionKey: 'measured_bp_today', booleanValue: true },
  { conditionType: 'hypertension' as const, questionKey: 'systolic', numberValue: systolic },
  { conditionType: 'hypertension' as const, questionKey: 'diastolic', numberValue: diastolic },
  ...Object.entries(symptoms).map(([questionKey, booleanValue]) => ({ conditionType: 'hypertension' as const, questionKey, booleanValue })),
]

async function saveCondition(db: FormdaDatabase, type: 'hypertension' | 'lumbar_disc_herniation') {
  await new HealthProfileRepository(db).saveBundle({
    profile: { ...createEntityMetadata(), id: HEALTH_PROFILE_ID, userId: USER_ID },
    conditions: [condition(type)],
    answers: [],
  })
}

describe('clinical hardening flows', () => {
  it('blocks after an initial high BP and requests a repeat measurement', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'hypertension')
    const service = new DailyHealthService(db, new HealthRiskEngine(), () => new Date('2026-08-24T08:00:00.000Z'))
    const result = await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(180, 90) })
    expect(result.check).toMatchObject({ initialHighBpDetected: true, repeatBpRequired: true })
    expect(result.evaluation).toMatchObject({ status: 'MEDICAL_REVIEW_REQUIRED', attentionLevel: 'REPEAT_MEASUREMENT' })
    expect(result.log.matchedRules.find((rule) => rule.ruleId === 'DAILY_HTN_REPEAT_REQUIRED')).toMatchObject({ ruleType: 'EVIDENCE_RULE', resultingStatus: 'MEDICAL_REVIEW_REQUIRED' })
    expect(result.log).toMatchObject({ rulesVersion: 3, evaluatedAt: expect.any(String) })
    db.close()
  })

  it('rejects a repeat BP recorded before one minute', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'hypertension')
    let now = new Date('2026-08-24T08:00:00.000Z')
    const service = new DailyHealthService(db, new HealthRiskEngine(), () => now)
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(181, 90) })
    now = new Date('2026-08-24T08:00:30.000Z')
    await expect(service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(181, 90), repeatSystolic: 181, repeatDiastolic: 90 })).rejects.toThrow('en az 1 dakika')
    db.close()
  })

  it('requires medical review when the repeat remains above 180/120 without symptoms', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'hypertension')
    let now = new Date('2026-08-24T08:00:00.000Z')
    const service = new DailyHealthService(db, new HealthRiskEngine(), () => now)
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(181, 90) })
    now = new Date('2026-08-24T08:01:01.000Z')
    const result = await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(181, 90), repeatSystolic: 181, repeatDiastolic: 90 })
    expect(result.check.repeatBpRequired).toBe(false)
    expect(result.evaluation).toMatchObject({ status: 'MEDICAL_REVIEW_REQUIRED', attentionLevel: 'MEDICAL_REVIEW' })
    expect(result.evaluation.triggeredRules).toContain('DAILY_HTN_REPEAT_REVIEW')
    db.close()
  })

  it('returns an urgent evaluation state for repeated high BP with an acute warning symptom', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'hypertension')
    let now = new Date('2026-08-24T08:00:00.000Z')
    const service = new DailyHealthService(db, new HealthRiskEngine(), () => now)
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(190, 125) })
    now = new Date('2026-08-24T08:01:05.000Z')
    const result = await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: true, responses: bpResponses(190, 125, { chest_pain: true }), repeatSystolic: 190, repeatDiastolic: 125 })
    expect(result.evaluation).toMatchObject({ status: 'MEDICAL_REVIEW_REQUIRED', attentionLevel: 'URGENT' })
    expect(result.evaluation.triggeredRules).toContain('DAILY_HTN_REPEAT_URGENT')
    db.close()
  })

  it('does not treat an exact 180/120 repeat as above the configured repeat threshold', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'hypertension')
    let now = new Date('2026-08-24T08:00:00.000Z')
    const service = new DailyHealthService(db, new HealthRiskEngine(), () => now)
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(180, 120) })
    now = new Date('2026-08-24T08:01:05.000Z')
    const result = await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: bpResponses(180, 120), repeatSystolic: 180, repeatDiastolic: 120 })
    expect(result.evaluation.status).toBe('MODIFIED')
    expect(result.evaluation.triggeredRules).not.toContain('DAILY_HTN_REPEAT_REVIEW')
    db.close()
  })

  it('requires a daily check before recording a pre-workout event', async () => {
    const db = new FormdaDatabase(testName())
    await expect(new DailyHealthService(db).createPreWorkout(USER_ID, { localDate: '2026-08-24', dailyHealthCheckId: crypto.randomUUID(), conditionChangedSinceDailyCheck: false, newSymptoms: false })).rejects.toThrow('güncel değil')
    expect(await db.preWorkoutChecks.count()).toBe(0)
    db.close()
  })

  it('stores a pre-workout red flag audit and prevents session creation', async () => {
    const db = new FormdaDatabase(testName()); await saveCondition(db, 'lumbar_disc_herniation')
    const health = new DailyHealthService(db)
    const daily = await health.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: [] })
    const preWorkout = await health.createPreWorkout(USER_ID, { localDate: '2026-08-24', dailyHealthCheckId: daily.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false, bladderChange: true })
    expect(preWorkout.evaluation.status).toBe('RED_FLAG_BLOCKED')
    expect(preWorkout.log.matchedRules.find((rule) => rule.ruleId === 'PRE_WORKOUT_LUMBAR_RED_FLAG')?.ruleType).toBe('EVIDENCE_RULE')

    const workouts = new WorkoutRepository(db)
    const plan = { ...createEntityMetadata(), userId: USER_ID, name: 'Validated', goal: 'maintain' as const, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL', active: true, generatedByRuleVersion: 2, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: new Date().toISOString() }
    const day = { ...createEntityMetadata(), workoutPlanId: plan.id, dayIndex: 0, scheduledWeekday: 1, name: 'Gün 1' }
    await workouts.savePlan(plan, [day], [])
    await expect(new WorkoutService(db).startSession(USER_ID, day.id, '2026-08-24', preWorkout.log.id, preWorkout.check.id)).rejects.toThrow('izin vermiyor')
    expect(await db.workoutSessions.count()).toBe(0)
    db.close()
  })
})
