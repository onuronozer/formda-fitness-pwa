import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { WorkoutRepository } from '../db/repositories'
import { WorkoutService } from '../services/WorkoutService'
import { DailyHealthService } from '../services/DailyHealthService'
import { createEntityMetadata } from '../domain/models'
import { USER_ID } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-logging-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })
const dayId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const exerciseId = 'exercise-push-up'

async function setup() {
  const db = new FormdaDatabase(testName()); const service = new WorkoutService(db); const repository = new WorkoutRepository(db)
  const now = '2026-08-24T08:00:00.000Z'
  const plan = { ...createEntityMetadata(now), userId: USER_ID, name: 'Test planı', goal: 'maintain' as const, daysPerWeek: 2, healthStatusAtGeneration: 'NORMAL', active: true, generatedByRuleVersion: 2, validationResult: { valid: true, errors: [], warnings: [] }, validatedAt: now }
  await repository.savePlan(plan, [{ ...createEntityMetadata(now), id: dayId, workoutPlanId: plan.id, dayIndex: 0, scheduledWeekday: 1, name: 'Gün 1' }], [])
  const health = new DailyHealthService(db)
  const daily = await health.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 0, energyLevel: 4, unusualSymptoms: false, responses: [] })
  const preWorkout = await health.createPreWorkout(USER_ID, { localDate: '2026-08-24', dailyHealthCheckId: daily.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false })
  const session = await service.startSession(USER_ID, dayId, '2026-08-24', preWorkout.log.id, preWorkout.check.id)
  return { db, service, repository, session }
}

describe('workout logging', () => {
  it('starts a session', async () => { const { db, session } = await setup(); expect(session.status).toBe('in_progress'); db.close() })

  it('completes and edits a set by stable identity', async () => {
    const { db, service, repository, session } = await setup()
    const first = await service.saveSet({ workoutSessionId: session.id, exerciseId, setNumber: 1, weightKg: 10, reps: 10, completed: true, painDuringSet: 'none' })
    const edited = await service.saveSet({ workoutSessionId: session.id, exerciseId, setNumber: 1, weightKg: 12, reps: 9, completed: true, painDuringSet: 'none' })
    expect(edited.id).toBe(first.id); expect(edited.version).toBe(2); expect((await repository.listSets(session.id))[0].weightKg).toBe(12)
    db.close()
  })

  it('keeps RPE optional', async () => {
    const { db, service, repository, session } = await setup()
    await service.saveSet({ workoutSessionId: session.id, exerciseId, setNumber: 1, reps: 10, completed: true, painDuringSet: 'none' })
    expect((await repository.listSets(session.id))[0].rpe).toBeUndefined(); db.close()
  })

  it('persists pain details', async () => {
    const { db, service, repository, session } = await setup()
    await service.saveSet({ workoutSessionId: session.id, exerciseId, setNumber: 1, reps: 8, completed: true, painDuringSet: 'moderate', painBodyArea: 'Sağ omuz' })
    expect((await repository.listSets(session.id))[0]).toMatchObject({ painDuringSet: 'moderate', painBodyArea: 'Sağ omuz' }); db.close()
  })

  it('completes a session', async () => { const { db, service, session } = await setup(); expect((await service.completeSession(session.id)).status).toBe('completed'); db.close() })
  it('keeps an incomplete session in progress', async () => { const { db, repository, session } = await setup(); expect((await repository.getSession(session.id))?.completedAt).toBeUndefined(); db.close() })
  it('stops a session for a health signal', async () => { const { db, service, session } = await setup(); expect((await service.stopForHealth(session.id)).status).toBe('stopped_for_health'); db.close() })

  it('persists session and sets across a database reload', async () => {
    const { db, service, session } = await setup(); const name = db.name
    await service.saveSet({ workoutSessionId: session.id, exerciseId, setNumber: 1, reps: 11, rpe: 7, completed: true, painDuringSet: 'mild' })
    db.close()
    const reopened = new FormdaDatabase(name); await reopened.open(); const repository = new WorkoutRepository(reopened)
    expect((await repository.getSession(session.id))?.status).toBe('in_progress'); expect((await repository.listSets(session.id))[0].reps).toBe(11)
    reopened.close()
  })
})
