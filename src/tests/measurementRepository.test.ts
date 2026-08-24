import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type StepRecord, type WaistRecord, type WeightRecord } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { MeasurementRepository, UserRepository } from '../db/repositories'
import { USER_ID, validProfile } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-measurements-${crypto.randomUUID()}`; names.push(name); return name }
const stamp = (localDate: string, hour = '08') => `${localDate}T${hour}:00:00.000Z`
const weight = (valueKg: number, localDate: string, hour = '08'): WeightRecord => ({ ...createEntityMetadata(stamp(localDate, hour)), userId: USER_ID, valueKg, localDate, measuredAt: stamp(localDate, hour), source: 'manual' })
const waist = (valueCm: number, localDate: string): WaistRecord => ({ ...createEntityMetadata(stamp(localDate)), userId: USER_ID, valueCm, localDate, measuredAt: stamp(localDate), source: 'manual' })
const steps = (stepCount: number, localDate: string): StepRecord => ({ ...createEntityMetadata(stamp(localDate, '12')), userId: USER_ID, stepCount, localDate, measuredAt: stamp(localDate, '12'), source: 'manual' })

afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('MeasurementRepository', () => {
  it('inserts multiple weights on the same day, edits by id and soft deletes', async () => {
    const db = new FormdaDatabase(testName())
    await new UserRepository(db).save(validProfile)
    const repository = new MeasurementRepository(db)
    const morning = await repository.insertWeight(weight(86.6, '2026-08-24', '08'))
    await repository.insertWeight(weight(87.1, '2026-08-24', '20'))
    expect(await repository.listWeights(USER_ID, '2026-08-24', '2026-08-24')).toHaveLength(2)

    const updated = await repository.updateWeight(morning.id, { valueKg: 85.4, localDate: morning.localDate, measuredAt: morning.measuredAt, note: 'Düzeltildi' })
    expect(updated.id).toBe(morning.id)
    expect(updated.version).toBe(2)
    expect(updated.valueKg).toBe(85.4)

    await repository.deleteWeight(morning.id)
    expect(await repository.listWeights(USER_ID)).toHaveLength(1)
    expect((await db.weightRecords.get(morning.id))?.deletedAt).toBeTruthy()
    db.close()
  })

  it('resolves equal measurement timestamps by creation order', async () => {
    const db = new FormdaDatabase(testName())
    await new UserRepository(db).save(validProfile)
    const repository = new MeasurementRepository(db)
    const first = weight(86.6, '2026-08-24', '08')
    const second = { ...weight(86.2, '2026-08-24', '08'), createdAt: '2026-08-24T08:00:01.000Z', updatedAt: '2026-08-24T08:00:01.000Z' }
    await repository.insertWeight(first)
    await repository.insertWeight(second)

    expect((await repository.getLatestWeight(USER_ID))?.id).toBe(second.id)
    expect((await repository.listWeights(USER_ID)).map((record) => record.id)).toEqual([first.id, second.id])
    expect((await db.userProfiles.get(USER_ID))?.currentWeightKg).toBe(86.2)
    db.close()
  })

  it('upserts manual steps for the same date and inserts different dates', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new MeasurementRepository(db)
    const first = await repository.upsertManualSteps(steps(4_000, '2026-08-24'))
    const updated = await repository.upsertManualSteps(steps(6_420, '2026-08-24'))
    await repository.upsertManualSteps(steps(8_100, '2026-08-23'))

    expect(updated.id).toBe(first.id)
    expect(updated.version).toBe(2)
    expect(updated.stepCount).toBe(6_420)
    expect(await repository.listSteps(USER_ID)).toHaveLength(2)
    db.close()
  })

  it('inserts, edits and soft deletes waist records across dates', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new MeasurementRepository(db)
    const first = await repository.insertWaist(waist(96, '2026-08-20'))
    await repository.insertWaist(waist(94, '2026-08-24'))
    const updated = await repository.updateWaist(first.id, { valueCm: 95.5, localDate: first.localDate, measuredAt: first.measuredAt, note: undefined })
    expect(updated.id).toBe(first.id)
    expect(updated.version).toBe(2)
    await repository.deleteWaist(first.id)
    expect((await repository.listWaists(USER_ID)).map((record) => record.valueCm)).toEqual([94])
    db.close()
  })
})
