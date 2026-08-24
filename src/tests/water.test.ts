import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { WaterService } from '../services/WaterService'
import { USER_ID } from './fixtures'

const names: string[] = []
const create = () => { const name = `formda-water-${crypto.randomUUID()}`; names.push(name); const db = new FormdaDatabase(name); return { db, service: new WaterService(db) } }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('WaterService', () => {
  it.each([200, 250, 330, 500])('adds the %i ml quick preset', async (amount) => {
    const { db, service } = create()
    const record = await service.add(USER_ID, amount, 'quick_add', '2026-08-24T09:00:00.000Z')
    expect(record).toMatchObject({ amountMl: amount, source: 'quick_add', localDate: '2026-08-24' })
    expect(await db.syncOutbox.count()).toBe(1); db.close()
  })

  it('accepts custom water and calculates the daily total', async () => {
    const { db, service } = create()
    await service.add(USER_ID, 150, 'manual', '2026-08-24T09:00:00.000Z')
    await service.add(USER_ID, 750, 'manual', '2026-08-24T12:00:00.000Z')
    expect(await service.getDailyTotal(USER_ID, '2026-08-24')).toBe(900); db.close()
  })

  it('edits and soft deletes records with outbox events', async () => {
    const { db, service } = create()
    const record = await service.add(USER_ID, 250, 'manual', '2026-08-24T09:00:00.000Z')
    const edited = await service.update(record.id, 330, record.consumedAt)
    expect(edited).toMatchObject({ amountMl: 330, version: 2 })
    await service.remove(record.id)
    expect(await service.getDailyTotal(USER_ID, '2026-08-24')).toBe(0)
    expect((await db.waterRecords.get(record.id))?.deletedAt).toBeTruthy()
    expect(await db.syncOutbox.count()).toBe(3); db.close()
  })

  it.each([0, -50, 3_001, 'abc'])('rejects an invalid single amount: %s', async (amount) => {
    const { db, service } = create()
    await expect(service.add(USER_ID, amount)).rejects.toBeTruthy()
    expect(await db.waterRecords.count()).toBe(0); db.close()
  })

  it('keeps totals separated by local date', async () => {
    const { db, service } = create()
    await service.add(USER_ID, 200, 'manual', '2026-08-23T09:00:00.000Z')
    await service.add(USER_ID, 500, 'manual', '2026-08-24T09:00:00.000Z')
    expect(await service.getDailyTotal(USER_ID, '2026-08-23')).toBe(200)
    expect(await service.getDailyTotal(USER_ID, '2026-08-24')).toBe(500); db.close()
  })

  it('prevents shortcut replay with a durable action receipt', async () => {
    const { db, service } = create()
    const first = await service.addShortcut(USER_ID, 250, 'shortcut-action-001', '2026-08-24T09:00:00.000Z')
    const replay = await service.addShortcut(USER_ID, 250, 'shortcut-action-001', '2026-08-24T09:00:01.000Z')
    expect(first.duplicate).toBe(false); expect(replay.duplicate).toBe(true)
    expect(await db.waterRecords.count()).toBe(1); expect(await db.shortcutActionReceipts.count()).toBe(1); db.close()
  })

  it('persists an offline write after reopening IndexedDB', async () => {
    const name = `formda-water-offline-${crypto.randomUUID()}`; names.push(name)
    const firstDb = new FormdaDatabase(name); await new WaterService(firstDb).add(USER_ID, 250, 'quick_add', '2026-08-24T09:00:00.000Z'); firstDb.close()
    const reopened = new FormdaDatabase(name); await reopened.open()
    expect(await reopened.waterRecords.count()).toBe(1); expect(await reopened.syncOutbox.count()).toBe(1); reopened.close()
  })
})
