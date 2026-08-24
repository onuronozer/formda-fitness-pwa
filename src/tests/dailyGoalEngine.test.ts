import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type DailyGoalSettings } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { DailyGoalEngine } from '../rules/goals'
import { DailyGoalService } from '../services/DailyGoalService'
import { USER_ID } from './fixtures'

const engine = new DailyGoalEngine()
const settings = (changes: Partial<DailyGoalSettings> = {}): DailyGoalSettings => ({ ...createEntityMetadata('2026-08-24T08:00:00.000Z'), userId: USER_ID, stepMode: 'adaptive', currentStepBaseline: 6_000, hydrationMode: 'program', ...changes })
const input = (changes: Partial<Parameters<DailyGoalEngine['generate']>[0]> = {}) => ({ userId: USER_ID, localDate: '2026-08-24', healthStatus: 'NORMAL' as const, recentSteps: [], settings: settings(), hydrationTargetMl: 2_400, now: '2026-08-24T08:00:00.000Z', ...changes })
const recent = (steps: number) => [1, 2, 3, 4, 5, 6, 7].map((day) => ({ localDate: `2026-08-${String(16 + day).padStart(2, '0')}`, steps }))
const names: string[] = []
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('DailyGoalEngine', () => {
  it('uses the configured baseline with no step history', () => expect(engine.generate(input()).stepTarget).toBe(6_000))
  it('does not adapt with insufficient history', () => expect(engine.generate(input({ recentSteps: recent(6_000).slice(0, 3) })).reasons).toContain('STEP_INSUFFICIENT_DATA'))
  it('builds a baseline when enough observations exist', () => expect(engine.generate(input({ recentSteps: recent(5_200), settings: settings({ currentStepBaseline: 8_000 }) })).reasons).toContain('STEP_BASELINE_RULE'))
  it('progresses gradually after high completion', () => expect(engine.generate(input({ recentSteps: recent(6_000) })).stepTarget).toBe(6_500))
  it('regresses gradually after low completion', () => expect(engine.generate(input({ recentSteps: recent(3_000) })).stepTarget).toBe(2_500))
  it('respects a manual override', () => expect(engine.generate(input({ settings: settings({ stepMode: 'manual', manualStepTarget: 7_200 }) })).stepTarget).toBe(7_200))
  it('does not progress a modified health day', () => expect(engine.generate(input({ healthStatus: 'MODIFIED', recentSteps: recent(6_000) })).stepTarget).toBe(6_000))
  it.each(['MEDICAL_REVIEW_REQUIRED', 'RED_FLAG_BLOCKED'] as const)('does not progress %s status', (healthStatus) => expect(engine.generate(input({ healthStatus, recentSteps: recent(6_000) })).stepTarget).toBe(6_000))
  it('marks workout and rest days explicitly', () => {
    expect(engine.generate(input({ workoutDayId: crypto.randomUUID() })).workoutTarget).toBe('workout')
    expect(engine.generate(input()).workoutTarget).toBe('rest')
  })
  it('only offers the interval on a normal rest day', () => {
    expect(engine.generate(input({ intervalProtocolId: 'interval-walking-beginner-1' })).cardioTarget).toBe('interval')
    expect(engine.generate(input({ healthStatus: 'MODIFIED', intervalProtocolId: 'interval-walking-beginner-1' })).cardioTarget).toBe('none')
  })

  it('keeps a historical plan immutable', async () => {
    const name = `formda-goals-${crypto.randomUUID()}`; names.push(name); const db = new FormdaDatabase(name)
    const service = new DailyGoalService(db)
    const old = { ...createEntityMetadata('2026-08-20T08:00:00.000Z'), userId: USER_ID, localDate: '2026-08-20', hydrationTargetMl: 2_400, stepTarget: 5_500, workoutTarget: 'rest' as const, cardioTarget: 'none' as const, generatedByVersion: 1, healthStatusAtGeneration: 'NORMAL' as const, reasons: ['REST_DAY_RULE'], generatedAt: '2026-08-20T08:00:00.000Z' }
    await db.dailyGoalPlans.add(old)
    expect(await service.getOrCreate(USER_ID, '2026-08-20', 'RED_FLAG_BLOCKED')).toEqual(old)
    expect((await db.dailyGoalPlans.get(old.id))?.version).toBe(1); db.close()
  })
})
