import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase, migrateLegacyDatabase } from '../db/database'
import { DATABASE_NAME, versionFiveStores, versionOneStores, versionSixStores, versionThreeStores, versionTwoStores } from '../db/schema'
import { UserRepository } from '../db/repositories'
import { validProfile } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-test-${crypto.randomUUID()}`; names.push(name); return name }

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})

describe('UserRepository', () => {
  it('uses a deployment-specific database namespace', () => {
    expect(DATABASE_NAME).toBe('formda-fitness-pwa-local-db')
  })

  it('copies a legacy database once without overwriting an existing target', async () => {
    const legacyName = testName()
    const targetName = testName()
    const legacy = new Dexie(legacyName)
    legacy.version(6).stores(versionSixStores)
    await legacy.open()
    await legacy.table('userProfiles').put({ ...validProfile, schemaVersion: 6 })
    legacy.close()

    const target = new FormdaDatabase(targetName)
    await expect(migrateLegacyDatabase(target, legacyName)).resolves.toBe(true)
    expect((await target.userProfiles.get(validProfile.id))?.displayName).toBe('Deniz')
    target.close()

    const reopened = new FormdaDatabase(targetName)
    await reopened.open()
    await reopened.userProfiles.put({ ...validProfile, displayName: 'Hedef kayıt', schemaVersion: 6 })
    reopened.close()

    const existingTarget = new FormdaDatabase(targetName)
    await expect(migrateLegacyDatabase(existingTarget, legacyName)).resolves.toBe(false)
    await existingTarget.open()
    expect((await existingTarget.userProfiles.get(validProfile.id))?.displayName).toBe('Hedef kayıt')
    existingTarget.close()
  })

  it('copies legacy v5 data before applying the v6 workspace migration', async () => {
    const legacyName = testName()
    const targetName = testName()
    const legacy = new Dexie(legacyName)
    legacy.version(5).stores(versionFiveStores)
    await legacy.open()
    await legacy.table('userProfiles').put({ ...validProfile, schemaVersion: 5 })
    legacy.close()

    const target = new FormdaDatabase(targetName)
    await expect(migrateLegacyDatabase(target, legacyName)).resolves.toBe(true)
    expect((await target.userProfiles.get(validProfile.id))?.schemaVersion).toBe(7)
    expect(await target.localWorkspaces.where('localUserId').equals(validProfile.id).first()).toMatchObject({ ownerType: 'LOCAL_ONLY', state: 'ACTIVE' })
    target.close()
  })

  it('saves, loads and updates a profile', async () => {
    const db = new FormdaDatabase(testName())
    const repository = new UserRepository(db)
    await repository.save(validProfile)
    expect((await repository.getActive())?.displayName).toBe('Deniz')
    const updated = await repository.save({ ...validProfile, displayName: 'Deniz Kaya' })
    expect(updated.version).toBe(2)
    expect((await repository.getById(validProfile.id))?.displayName).toBe('Deniz Kaya')
    db.close()
  })

  it('migrates a version 1 profile and creates its initial weight record', async () => {
    const name = testName()
    const oldDb = new Dexie(name)
    oldDb.version(1).stores(versionOneStores)
    await oldDb.table('userProfiles').put({ ...validProfile, schemaVersion: 1 })
    oldDb.close()

    const db = new FormdaDatabase(name)
    await db.open()
    expect((await db.userProfiles.get(validProfile.id))?.schemaVersion).toBe(7)
    const initialWeight = await db.weightRecords.where('userId').equals(validProfile.id).first()
    expect(initialWeight?.valueKg).toBe(validProfile.currentWeightKg)
    expect(initialWeight?.localDate).toBe('2026-08-24')
    db.close()
  })

  it('migrates a Phase 2 v3 database to v5 without losing measurements', async () => {
    const name = testName()
    const oldDb = new Dexie(name)
    oldDb.version(1).stores(versionOneStores)
    oldDb.version(2).stores(versionTwoStores)
    oldDb.version(3).stores(versionThreeStores)
    await oldDb.open()
    await oldDb.table('userProfiles').put({ ...validProfile, schemaVersion: 3 })
    await oldDb.table('weightRecords').put({ ...validProfile, id: crypto.randomUUID(), userId: validProfile.id, valueKg: 77, measuredAt: '2026-08-24T08:00:00.000Z', localDate: '2026-08-24', source: 'manual', schemaVersion: 3 })
    oldDb.close()

    const db = new FormdaDatabase(name)
    await db.open()
    expect((await db.userProfiles.get(validProfile.id))?.schemaVersion).toBe(7)
    expect((await db.weightRecords.where('userId').equals(validProfile.id).first())?.valueKg).toBe(77)
    expect(db.tables.map((table) => table.name)).toContain('workoutSessions')
    db.close()
  })

  it('repairs duplicate Phase 2 seed versions during the v4 migration and upgrades to v5', async () => {
    const name = testName()
    const oldDb = new Dexie(name)
    oldDb.version(3).stores({ ...versionThreeStores, seedVersions: 'id, dataset, dataVersion, appliedAt' })
    await oldDb.open()
    expect(oldDb.table('seedVersions').schema.idxByName.dataset.unique).toBe(false)
    await oldDb.table('seedVersions').put({ id: 'old-rules', dataset: 'health_rules', dataVersion: 1, appliedAt: '2026-08-01T00:00:00.000Z' })
    await expect(oldDb.table('seedVersions').put({ id: 'new-rules', dataset: 'health_rules', dataVersion: 2, appliedAt: '2026-08-24T00:00:00.000Z' })).resolves.toBe('new-rules')
    oldDb.close()

    const db = new FormdaDatabase(name)
    await db.open()
    const rulesSeeds = await db.seedVersions.where('dataset').equals('health_rules').toArray()
    expect(rulesSeeds).toHaveLength(1)
    expect(rulesSeeds[0]).toMatchObject({ id: 'new-rules', dataVersion: 2, schemaVersion: 5 })
    db.close()
  })

  it('migrates version 2 measurement dates and source names', async () => {
    const name = testName()
    const oldDb = new Dexie(name)
    oldDb.version(1).stores(versionOneStores)
    oldDb.version(2).stores(versionTwoStores)
    await oldDb.open()
    await oldDb.table('userProfiles').put({ ...validProfile, schemaVersion: 2 })
    await oldDb.table('weightRecords').put({ ...validProfile, id: crypto.randomUUID(), userId: validProfile.id, valueKg: 77, measuredAt: '2026-08-23T21:30:00.000Z', source: 'imported', note: undefined })
    await oldDb.table('stepRecords').put({ ...validProfile, id: crypto.randomUUID(), userId: validProfile.id, stepCount: 4200, date: '2026-08-24', source: 'manual' })
    oldDb.close()

    const db = new FormdaDatabase(name)
    await db.open()
    const migratedWeight = await db.weightRecords.where('userId').equals(validProfile.id).first()
    const migratedSteps = await db.stepRecords.where('userId').equals(validProfile.id).first()
    expect(migratedWeight?.source).toBe('import')
    expect(migratedWeight?.localDate).toMatch(/^2026-08-2[34]$/)
    expect(migratedSteps?.localDate).toBe('2026-08-24')
    expect(migratedSteps?.measuredAt).toBeTruthy()
    db.close()
  })
})
