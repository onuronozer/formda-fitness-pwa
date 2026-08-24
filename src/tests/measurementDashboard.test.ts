import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { MeasurementRepository, UserRepository } from '../db/repositories'
import { MeasurementDashboardService } from '../services/MeasurementDashboardService'
import { USER_ID, validProfile } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-dashboard-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('MeasurementDashboardService', () => {
  it('returns explicit empty metrics when measurements do not exist', async () => {
    const db = new FormdaDatabase(testName())
    await new UserRepository(db).save(validProfile)
    const summary = await new MeasurementDashboardService(new MeasurementRepository(db)).getTodaySummary(USER_ID, 70, '2026-08-24')
    expect(summary.weight.latestWeight).toBeUndefined()
    expect(summary.waist.latest).toBeUndefined()
    expect(summary.steps.todaySteps).toBeUndefined()
    db.close()
  })

  it('uses latest weight and waist values plus same-date steps on Today', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new MeasurementRepository(db)
    await new UserRepository(db).save(validProfile)
    await repository.insertWeight({ ...createEntityMetadata('2026-08-20T08:00:00.000Z'), userId: USER_ID, valueKg: 80, measuredAt: '2026-08-20T08:00:00.000Z', localDate: '2026-08-20', source: 'manual' })
    await repository.insertWeight({ ...createEntityMetadata('2026-08-24T20:00:00.000Z'), userId: USER_ID, valueKg: 78.4, measuredAt: '2026-08-24T20:00:00.000Z', localDate: '2026-08-24', source: 'manual' })
    await repository.insertWaist({ ...createEntityMetadata(), userId: USER_ID, valueCm: 94, measuredAt: '2026-08-24T07:00:00.000Z', localDate: '2026-08-24', source: 'manual' })
    await repository.upsertManualSteps({ ...createEntityMetadata(), userId: USER_ID, stepCount: 6420, measuredAt: '2026-08-24T12:00:00.000Z', localDate: '2026-08-24', source: 'manual' })

    const summary = await new MeasurementDashboardService(repository).getTodaySummary(USER_ID, 70, '2026-08-24')
    expect(summary.weight.latestWeight).toBe(78.4)
    expect(summary.weight.changeFromStart).toBe(-1.6)
    expect(summary.waist.latest).toBe(94)
    expect(summary.steps.todaySteps).toBe(6420)
    db.close()
  })
})
