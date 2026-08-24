import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type DailyHealthCheck, type DailyHealthResponse, type PreWorkoutCheck } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { HealthCheckRepository } from '../db/repositories'
import { HealthRiskEngine } from '../rules/health'
import { DailyHealthService } from '../services/DailyHealthService'
import { answer, condition, USER_ID } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-daily-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

const daily = (changes: Partial<DailyHealthCheck> = {}): DailyHealthCheck => ({ ...createEntityMetadata(), userId: USER_ID, localDate: '2026-08-24', checkedAt: '2026-08-24T08:00:00.000Z', revision: 1, overallPain: 0, energyLevel: 4, unusualSymptoms: false, ...changes })
const response = (conditionType: DailyHealthResponse['conditionType'], questionKey: string, value: boolean | number): DailyHealthResponse => ({ ...createEntityMetadata(), userId: USER_ID, healthCheckId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', conditionType, questionKey, ...(typeof value === 'boolean' ? { booleanValue: value } : { numberValue: value }) })
const pre = (changes: Partial<PreWorkoutCheck> = {}): PreWorkoutCheck => ({ ...createEntityMetadata(), userId: USER_ID, dailyHealthCheckId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', localDate: '2026-08-24', checkedAt: '2026-08-24T08:10:00.000Z', conditionChangedSinceDailyCheck: false, newSymptoms: false, resultingHealthStatus: 'NORMAL', ...changes })

describe('daily health evaluation', () => {
  it('keeps a no-condition normal check NORMAL', () => expect(new HealthRiskEngine().evaluate({ conditions: [], answers: [], dailyCheck: daily() }).status).toBe('NORMAL'))

  it('keeps unchanged lumbar symptoms at the profile MODIFIED level', () => {
    const lumbar = condition('lumbar_disc_herniation')
    expect(new HealthRiskEngine().evaluate({ conditions: [lumbar], answers: [], dailyCheck: daily(), dailyResponses: [] }).status).toBe('MODIFIED')
  })

  it('requires review for new lumbar numbness', () => {
    const lumbar = condition('lumbar_disc_herniation')
    const result = new HealthRiskEngine().evaluate({ conditions: [lumbar], answers: [], dailyCheck: daily(), dailyResponses: [response('lumbar_disc_herniation', 'new_numbness', true)] })
    expect(result.status).toBe('MEDICAL_REVIEW_REQUIRED')
  })

  it('blocks a lumbar daily red flag', () => {
    const lumbar = condition('lumbar_disc_herniation')
    const result = new HealthRiskEngine().evaluate({ conditions: [lumbar], answers: [answer(lumbar.id, 'acute_flare', false)], dailyCheck: daily(), dailyResponses: [response('lumbar_disc_herniation', 'bladder_change', true)] })
    expect(result.status).toBe('RED_FLAG_BLOCKED')
    expect(result.triggeredRules).toContain('DAILY_LUMBAR_RED_FLAG')
  })

  it('keeps a normal hypertension daily check MODIFIED', () => {
    const htn = condition('hypertension')
    expect(new HealthRiskEngine().evaluate({ conditions: [htn], answers: [], dailyCheck: daily(), dailyResponses: [] }).status).toBe('MODIFIED')
  })

  it('requires review for a concerning hypertension symptom', () => {
    const htn = condition('hypertension')
    expect(new HealthRiskEngine().evaluate({ conditions: [htn], answers: [], dailyCheck: daily(), dailyResponses: [response('hypertension', 'chest_pain', true)] }).status).toBe('MEDICAL_REVIEW_REQUIRED')
  })

  it('creates auditable revisions instead of replacing a daily check', async () => {
    const db = new FormdaDatabase(testName())
    const service = new DailyHealthService(db)
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 1, energyLevel: 4, unusualSymptoms: false, responses: [] })
    await service.saveDailyCheck(USER_ID, { localDate: '2026-08-24', overallPain: 4, energyLevel: 2, unusualSymptoms: false, responses: [] })
    const revisions = await new HealthCheckRepository(db).listDailyRevisions(USER_ID, '2026-08-24')
    expect(revisions.map((item) => item.revision)).toEqual([1, 2])
    expect(revisions[1].supersedesId).toBe(revisions[0].id)
    db.close()
  })

  it('allows an unchanged pre-workout check to retain the daily result', () => {
    expect(new HealthRiskEngine().evaluate({ conditions: [], answers: [], dailyCheck: daily(), preWorkoutCheck: pre() }).status).toBe('NORMAL')
  })

  it('requires review when pre-workout symptoms changed', () => {
    expect(new HealthRiskEngine().evaluate({ conditions: [], answers: [], dailyCheck: daily(), preWorkoutCheck: pre({ conditionChangedSinceDailyCheck: true, newSymptoms: true }) }).status).toBe('MEDICAL_REVIEW_REQUIRED')
  })
})
