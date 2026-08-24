import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { BackupService, BackupValidationError } from '../services/BackupService'
import { UserRepository } from '../db/repositories'
import { validProfile } from './fixtures'
import { createEntityMetadata } from '../domain/models'
import { DailyHealthService } from '../services/DailyHealthService'
import { WorkoutService } from '../services/WorkoutService'
import { WaterService } from '../services/WaterService'
import { DailyGoalService } from '../services/DailyGoalService'

const names: string[] = []
const testName = () => { const name = `formda-backup-${crypto.randomUUID()}`; names.push(name); return name }

afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('BackupService', () => {
  it('exports and imports Phase 2 measurement data', async () => {
    const source = new FormdaDatabase(testName())
    await new UserRepository(source).save(validProfile)
    await source.weightRecords.add({ ...createEntityMetadata(), userId: validProfile.id, valueKg: 76.5, measuredAt: '2026-08-24T06:00:00.000Z', localDate: '2026-08-24', source: 'manual' })
    await source.waistRecords.add({ ...createEntityMetadata(), userId: validProfile.id, valueCm: 88, measuredAt: '2026-08-24T06:05:00.000Z', localDate: '2026-08-24', source: 'manual' })
    await source.stepRecords.add({ ...createEntityMetadata(), userId: validProfile.id, stepCount: 6420, measuredAt: '2026-08-24T09:00:00.000Z', localDate: '2026-08-24', source: 'manual' })
    const exported = await new BackupService(source).exportData()
    expect(exported.schemaVersion).toBe(5)
    expect(exported.userData.userProfiles).toHaveLength(1)

    const target = new FormdaDatabase(testName())
    await new BackupService(target).importData(exported)
    expect((await new UserRepository(target).getActive())?.displayName).toBe('Deniz')
    expect(await target.weightRecords.count()).toBe(1)
    expect(await target.waistRecords.count()).toBe(1)
    expect((await target.stepRecords.toArray())[0].stepCount).toBe(6420)
    source.close()
    target.close()
  })

  it('rejects invalid data before changing the database', async () => {
    const db = new FormdaDatabase(testName())
    await new UserRepository(db).save(validProfile)
    const service = new BackupService(db)
    await expect(service.importData({ schemaVersion: 999 })).rejects.toBeInstanceOf(BackupValidationError)
    expect(await db.userProfiles.count()).toBe(1)
    db.close()
  })

  it('imports a Phase 1 schema v2 backup and migrates legacy measurements', async () => {
    const db = new FormdaDatabase(testName())
    const now = '2026-08-24T08:00:00.000Z'
    const legacy = {
      schemaVersion: 2,
      exportedAt: now,
      appVersion: '0.1.0',
      userData: {
        userProfiles: [{ ...validProfile, schemaVersion: 2 }],
        healthProfiles: [], healthConditions: [], conditionAnswers: [], healthEvaluationLogs: [],
        weightRecords: [{ ...createEntityMetadata(now), schemaVersion: 2, userId: validProfile.id, valueKg: 77, measuredAt: now, source: 'imported' }],
        waistRecords: [{ ...createEntityMetadata(now), schemaVersion: 2, userId: validProfile.id, valueCm: 89, measuredAt: now, source: 'manual' }],
        stepRecords: [{ ...createEntityMetadata(now), schemaVersion: 2, userId: validProfile.id, stepCount: 5000, date: '2026-08-24', source: 'manual' }],
      },
    }
    const result = await new BackupService(db).importData(legacy)
    expect(result.importedSchemaVersion).toBe(2)
    expect((await db.weightRecords.toArray())[0]).toMatchObject({ source: 'import', localDate: '2026-08-24', schemaVersion: 5 })
    expect((await db.waistRecords.toArray())[0].localDate).toBe('2026-08-24')
    expect((await db.stepRecords.toArray())[0]).toMatchObject({ localDate: '2026-08-24', schemaVersion: 5 })
    db.close()
  })

  it('rejects an invalid measurement without replacing existing data', async () => {
    const db = new FormdaDatabase(testName())
    await new UserRepository(db).save(validProfile)
    const service = new BackupService(db)
    const backup = await service.exportData()
    const invalid = { ...backup, userData: { ...backup.userData, weightRecords: [{ ...createEntityMetadata(), userId: validProfile.id, valueKg: 999, measuredAt: '2026-08-24T08:00:00.000Z', localDate: '2026-08-24', source: 'manual' }] } }
    await expect(service.importData(invalid)).rejects.toBeInstanceOf(BackupValidationError)
    expect(await db.userProfiles.count()).toBe(1)
    db.close()
  })

  it('exports and imports Phase 3A health revisions and workout logs', async () => {
    const source = new FormdaDatabase(testName())
    await new UserRepository(source).save(validProfile)
    const health = await new DailyHealthService(source).saveDailyCheck(validProfile.id, { localDate: '2026-08-24', overallPain: 2, energyLevel: 4, unusualSymptoms: false, responses: [] })
    const preWorkout = await new DailyHealthService(source).createPreWorkout(validProfile.id, { localDate: '2026-08-24', dailyHealthCheckId: health.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false })
    const workout = new WorkoutService(source)
    const generated = await workout.generatePlan(validProfile.id, health.log)
    if (!generated.plan || !generated.days) throw new Error('Test planı üretilemedi.')
    const session = await workout.startSession(validProfile.id, generated.days[0].id, '2026-08-24', preWorkout.log.id, preWorkout.check.id)
    await workout.saveSet({ workoutSessionId: session.id, exerciseId: 'exercise-push-up', setNumber: 1, reps: 10, completed: true, painDuringSet: 'none' })
    const exported = await new BackupService(source).exportData()
    expect(exported.seedManifest.exercises).toBe(2)

    const target = new FormdaDatabase(testName())
    await new BackupService(target).importData(exported)
    expect(await target.dailyHealthChecks.count()).toBe(1)
    expect(await target.workoutSessions.count()).toBe(1)
    expect((await target.workoutPlans.toArray())[0].validationResult?.valid).toBe(true)
    expect((await target.workoutSets.toArray())[0].reps).toBe(10)
    source.close(); target.close()
  })

  it('imports a Phase 2 schema v3 backup with empty Phase 3A tables', async () => {
    const source = new FormdaDatabase(testName())
    await new UserRepository(source).save(validProfile)
    const current = await new BackupService(source).exportData()
    const phaseTwoData = {
      userProfiles: current.userData.userProfiles, healthProfiles: current.userData.healthProfiles, healthConditions: current.userData.healthConditions,
      conditionAnswers: current.userData.conditionAnswers, healthEvaluationLogs: current.userData.healthEvaluationLogs,
      weightRecords: current.userData.weightRecords, waistRecords: current.userData.waistRecords, stepRecords: current.userData.stepRecords,
    }
    const phaseTwo = { schemaVersion: 3, exportedAt: current.exportedAt, appVersion: '0.2.0', userData: phaseTwoData }
    const target = new FormdaDatabase(testName())
    expect((await new BackupService(target).importData(phaseTwo)).importedSchemaVersion).toBe(3)
    expect(await target.dailyHealthChecks.count()).toBe(0)
    expect((await new UserRepository(target).getActive())?.displayName).toBe('Deniz')
    source.close(); target.close()
  })

  it('imports an earlier schema v4 backup without hardening audit fields', async () => {
    const source = new FormdaDatabase(testName()); await new UserRepository(source).save(validProfile)
    const daily = await new DailyHealthService(source).saveDailyCheck(validProfile.id, { localDate: '2026-08-24', overallPain: 1, energyLevel: 4, unusualSymptoms: false, responses: [] })
    await new DailyHealthService(source).createPreWorkout(validProfile.id, { localDate: '2026-08-24', dailyHealthCheckId: daily.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false })
    const backup = await new BackupService(source).exportData()
    const legacyV4 = structuredClone(backup) as unknown as Record<string, unknown>
    legacyV4.schemaVersion = 4
    const userData = legacyV4.userData as Record<string, Array<Record<string, unknown>>>
    for (const key of ['waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions', 'cloudSyncPreferences']) delete userData[key]
    for (const log of userData.healthEvaluationLogs) { delete log.matchedRules; delete log.attentionLevel; for (const entry of log.debugEntries as Array<Record<string, unknown>>) { delete entry.ruleType; delete entry.evidenceIds } }
    for (const check of userData.dailyHealthChecks) { delete check.initialHighBpDetected; delete check.repeatBpRequired }
    for (const check of userData.preWorkoutChecks) { delete check.bladderChange; delete check.bowelChange; delete check.saddleNumbness; delete check.progressiveMotorWeakness }

    const target = new FormdaDatabase(testName())
    await expect(new BackupService(target).importData(legacyV4)).resolves.toEqual({ importedSchemaVersion: 4 })
    expect((await target.dailyHealthChecks.toArray())[0]).toMatchObject({ initialHighBpDetected: false, repeatBpRequired: false })
    expect((await target.healthEvaluationLogs.toArray())[0]).toMatchObject({ matchedRules: [], attentionLevel: 'ROUTINE' })
    expect(await target.preWorkoutChecks.count()).toBe(1)
    source.close(); target.close()
  })

  it('exports and imports Phase 3B user data in backup v5', async () => {
    const source = new FormdaDatabase(testName()); await new UserRepository(source).save(validProfile)
    await new WaterService(source).add(validProfile.id, 250, 'quick_add', '2026-08-24T09:00:00.000Z')
    await new DailyGoalService(source).getOrCreate(validProfile.id, '2026-08-24', 'NORMAL')
    const backup = await new BackupService(source).exportData()
    expect(backup.schemaVersion).toBe(5); expect(backup.userData.waterRecords).toHaveLength(1); expect(backup.userData.dailyGoalPlans).toHaveLength(1)
    const target = new FormdaDatabase(testName()); await new BackupService(target).importData(backup)
    expect(await target.waterRecords.count()).toBe(1); expect(await target.dailyHydrationTargets.count()).toBe(1); expect(await target.dailyGoalSettings.count()).toBe(1); expect(await target.dailyGoalPlans.count()).toBe(1)
    source.close(); target.close()
  })
})
