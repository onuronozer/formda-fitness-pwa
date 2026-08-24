import { EXERCISE_SEED_VERSION } from '../config/workouts'
import { NUTRITION_SEED_VERSION } from '../config/nutrition'
import { createEntityMetadata } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'
import { toLocalDate } from '../utils/localDate'
import { backupImportSchema, backupPayloadSchema, BACKUP_SCHEMA_VERSION, type BackupPayload, type LegacyBackupPayload, type PhaseThreeBackupPayload, type PhaseThreeBBackupPayload, type PhaseTwoBackupPayload } from '../validation/backupSchema'
import { LocalDataService } from './LocalDataService'
import { WorkspaceService } from './WorkspaceService'

export class BackupValidationError extends Error {
  constructor(message = 'Yedek dosyası geçerli değil.') { super(message); this.name = 'BackupValidationError' }
}

const metadataCurrent = <T extends { schemaVersion: number }>(record: T) => ({ ...record, schemaVersion: 7 })
const sourceFromLegacy = (source: 'manual' | 'imported') => source === 'imported' ? 'import' as const : source
const emptyNutritionData = { foods: [], recipes: [], recipeIngredients: [], favoriteFoods: [], meals: [], mealItems: [], dailyNutritionTargets: [], nutritionSettings: [] }

function phaseTwoToCurrent(backup: PhaseTwoBackupPayload): BackupPayload {
  return backupPayloadSchema.parse({
    schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: backup.exportedAt, appVersion: backup.appVersion, seedManifest: { exercises: EXERCISE_SEED_VERSION, foods: NUTRITION_SEED_VERSION, recipes: NUTRITION_SEED_VERSION },
    userData: {
      ...Object.fromEntries(Object.entries(backup.userData).map(([key, records]) => [key, records.map(metadataCurrent)])),
      dailyHealthChecks: [], dailyHealthResponses: [], preWorkoutChecks: [], workoutPlans: [], workoutDays: [], workoutExercises: [], workoutSessions: [], workoutSets: [],
      waterRecords: [], dailyHydrationTargets: [], dailyGoalSettings: [], dailyGoalPlans: [], cardioSessions: [], cloudSyncPreferences: [],
      ...emptyNutritionData,
    },
  })
}

function phaseThreeToCurrent(backup: PhaseThreeBackupPayload): BackupPayload {
  return backupPayloadSchema.parse({
    schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: backup.exportedAt, appVersion: backup.appVersion, seedManifest: { ...backup.seedManifest, foods: NUTRITION_SEED_VERSION, recipes: NUTRITION_SEED_VERSION },
    userData: {
      ...Object.fromEntries(Object.entries(backup.userData).map(([key, records]) => [key, records.map(metadataCurrent)])),
      waterRecords: [], dailyHydrationTargets: [], dailyGoalSettings: [], dailyGoalPlans: [], cardioSessions: [], cloudSyncPreferences: [],
      ...emptyNutritionData,
    },
  })
}

function phaseThreeBToCurrent(backup: PhaseThreeBBackupPayload): BackupPayload {
  return backupPayloadSchema.parse({
    schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: backup.exportedAt, appVersion: backup.appVersion,
    seedManifest: { ...backup.seedManifest, foods: NUTRITION_SEED_VERSION, recipes: NUTRITION_SEED_VERSION },
    userData: { ...Object.fromEntries(Object.entries(backup.userData).map(([key, records]) => [key, records.map(metadataCurrent)])), ...emptyNutritionData },
  })
}

function migrateLegacyBackup(legacy: LegacyBackupPayload): BackupPayload {
  const weightRecords = legacy.userData.weightRecords.map((record) => ({ ...metadataCurrent(record), localDate: toLocalDate(record.measuredAt), source: sourceFromLegacy(record.source) }))
  for (const profile of legacy.userData.userProfiles) {
    if (weightRecords.some((record) => record.userId === profile.id && !record.deletedAt)) continue
    weightRecords.push({ ...createEntityMetadata(profile.createdAt), userId: profile.id, valueKg: profile.currentWeightKg, measuredAt: profile.createdAt, localDate: toLocalDate(profile.createdAt), source: 'manual', note: 'Başlangıç ölçümü' })
  }
  return phaseTwoToCurrent({
    schemaVersion: 3, exportedAt: legacy.exportedAt, appVersion: legacy.appVersion,
    userData: {
      userProfiles: legacy.userData.userProfiles.map(metadataCurrent), healthProfiles: legacy.userData.healthProfiles.map(metadataCurrent),
      healthConditions: legacy.userData.healthConditions.map(metadataCurrent), conditionAnswers: legacy.userData.conditionAnswers.map(metadataCurrent),
      healthEvaluationLogs: legacy.userData.healthEvaluationLogs.map(metadataCurrent), weightRecords,
      waistRecords: legacy.userData.waistRecords.map((record) => ({ ...metadataCurrent(record), localDate: toLocalDate(record.measuredAt), source: sourceFromLegacy(record.source) })),
      stepRecords: legacy.userData.stepRecords.map((record) => ({ ...metadataCurrent(record), measuredAt: new Date(`${record.date}T12:00:00`).toISOString(), localDate: record.date, source: sourceFromLegacy(record.source) })),
    },
  })
}

export class BackupService {
  private readonly localData: LocalDataService
  private readonly workspaces: WorkspaceService
  constructor(private readonly db: FormdaDatabase = appDb) { this.localData = new LocalDataService(db); this.workspaces = new WorkspaceService(db) }

  async exportData(): Promise<BackupPayload> {
    const workspace = await this.workspaces.getActive()
    if (!workspace?.localUserId) throw new BackupValidationError('Yedeklenecek aktif profil bulunamadı.')
    const values = await this.scopedValues(workspace.localUserId)
    return backupPayloadSchema.parse({
      schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), appVersion: __APP_VERSION__, seedManifest: { exercises: EXERCISE_SEED_VERSION, foods: NUTRITION_SEED_VERSION, recipes: NUTRITION_SEED_VERSION },
      userData: Object.fromEntries(this.userTableNames().map((name, index) => [name, values[index]])),
    })
  }

  async importData(input: unknown): Promise<{ importedSchemaVersion: 2 | 3 | 4 | 5 | 6 }> {
    const result = backupImportSchema.safeParse(input)
    if (!result.success) throw new BackupValidationError()
    const importedSchemaVersion = result.data.schemaVersion
    const payload = importedSchemaVersion === 2 ? migrateLegacyBackup(result.data) : importedSchemaVersion === 3 ? phaseTwoToCurrent(result.data) : importedSchemaVersion === 4 ? phaseThreeToCurrent(result.data) : importedSchemaVersion === 5 ? phaseThreeBToCurrent(result.data) : result.data
    const importedProfile = payload.userData.userProfiles.find((profile) => !profile.deletedAt)
    if (!importedProfile) throw new BackupValidationError('Yedekte aktif profil bulunamadı.')
    const active = await this.workspaces.getActive()
    if (active?.ownerType === 'AUTHENTICATED') throw new BackupValidationError('Cloud hesabından çıkış yaptıktan sonra geri yükle.')
    if (active?.localUserId) await this.localData.wipeUser(active.localUserId)
    const tables = this.userTables()
    const data = payload.userData as unknown as Record<string, unknown[]>
    await this.db.transaction('rw', tables, async () => {
      for (const [index, name] of this.userTableNames().entries()) {
        if (!data[name].length) continue
        const records = name === 'cloudSyncPreferences' ? [] : data[name]
        await tables[index].bulkPut(records)
      }
    })
    await this.workspaces.ensureLocal(importedProfile.id)
    return { importedSchemaVersion }
  }

  private async scopedValues(userId: string) {
    const planIds = await this.db.workoutPlans.where('userId').equals(userId).primaryKeys()
    const dayIds = planIds.length ? await this.db.workoutDays.where('workoutPlanId').anyOf(planIds).primaryKeys() : []
    const sessionIds = await this.db.workoutSessions.where('userId').equals(userId).primaryKeys()
    const recipeIds = await this.db.recipes.where('userId').equals(userId).primaryKeys()
    const mealIds = await this.db.meals.where('userId').equals(userId).primaryKeys()
    const direct = async (name: string) => name === 'userProfiles'
      ? (await this.db.userProfiles.get(userId) ? [await this.db.userProfiles.get(userId)] : []).filter(Boolean)
      : this.db.table(name).where('userId').equals(userId).toArray()
    return Promise.all(this.userTableNames().map((name) => {
      if (name === 'cloudSyncPreferences') return Promise.resolve([])
      if (name === 'workoutDays') return planIds.length ? this.db.workoutDays.where('workoutPlanId').anyOf(planIds).toArray() : Promise.resolve([])
      if (name === 'workoutExercises') return dayIds.length ? this.db.workoutExercises.where('workoutDayId').anyOf(dayIds).toArray() : Promise.resolve([])
      if (name === 'workoutSets') return sessionIds.length ? this.db.workoutSets.where('workoutSessionId').anyOf(sessionIds).toArray() : Promise.resolve([])
      if (name === 'recipeIngredients') return recipeIds.length ? this.db.recipeIngredients.where('recipeId').anyOf(recipeIds).toArray() : Promise.resolve([])
      if (name === 'mealItems') return mealIds.length ? this.db.mealItems.where('mealId').anyOf(mealIds).toArray() : Promise.resolve([])
      return direct(name)
    }))
  }

  private userTableNames() {
    return ['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutPlans', 'workoutDays', 'workoutExercises', 'workoutSessions', 'workoutSets', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions', 'cloudSyncPreferences', 'foods', 'recipes', 'recipeIngredients', 'favoriteFoods', 'meals', 'mealItems', 'dailyNutritionTargets', 'nutritionSettings'] as const
  }
  private userTables() { return this.userTableNames().map((name) => this.db.table(name)) }
}
