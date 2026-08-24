import Dexie, { type EntityTable } from 'dexie'
import type {
  ConditionAnswer,
  CardioSession,
  CloudSyncPreference,
  DailyHealthCheck,
  DailyHealthResponse,
  DailyGoalPlan,
  DailyGoalSettings,
  DailyHydrationTarget,
  Equipment,
  EvidenceReference,
  Exercise,
  ExerciseHealthConsideration,
  ExerciseMedia,
  HealthCondition,
  HealthEvaluationLog,
  HealthProfile,
  Muscle,
  IntervalProtocol,
  LocalWorkspace,
  PreWorkoutCheck,
  SeedVersion,
  StepRecord,
  ShortcutActionReceipt,
  SyncOutboxEvent,
  SyncConflictAudit,
  UserProfile,
  WaistRecord,
  WeightRecord,
  WorkoutDay,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutSession,
  WorkoutSet,
  WaterRecord,
} from '../domain/models'
import { toLocalDate } from '../utils/localDate'
import { DATABASE_NAME, versionFiveStores, versionFourStores, versionOneStores, versionSixStores, versionThreeStores, versionTwoStores } from './schema'

export class FormdaDatabase extends Dexie {
  userProfiles!: EntityTable<UserProfile, 'id'>
  healthProfiles!: EntityTable<HealthProfile, 'id'>
  healthConditions!: EntityTable<HealthCondition, 'id'>
  conditionAnswers!: EntityTable<ConditionAnswer, 'id'>
  weightRecords!: EntityTable<WeightRecord, 'id'>
  waistRecords!: EntityTable<WaistRecord, 'id'>
  stepRecords!: EntityTable<StepRecord, 'id'>
  healthEvaluationLogs!: EntityTable<HealthEvaluationLog, 'id'>
  seedVersions!: EntityTable<SeedVersion, 'id'>
  evidenceReferences!: EntityTable<EvidenceReference, 'id'>
  dailyHealthChecks!: EntityTable<DailyHealthCheck, 'id'>
  dailyHealthResponses!: EntityTable<DailyHealthResponse, 'id'>
  preWorkoutChecks!: EntityTable<PreWorkoutCheck, 'id'>
  muscles!: EntityTable<Muscle, 'id'>
  equipment!: EntityTable<Equipment, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  exerciseHealthConsiderations!: EntityTable<ExerciseHealthConsideration, 'id'>
  exerciseMedia!: EntityTable<ExerciseMedia, 'id'>
  workoutPlans!: EntityTable<WorkoutPlan, 'id'>
  workoutDays!: EntityTable<WorkoutDay, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>
  waterRecords!: EntityTable<WaterRecord, 'id'>
  dailyHydrationTargets!: EntityTable<DailyHydrationTarget, 'id'>
  dailyGoalSettings!: EntityTable<DailyGoalSettings, 'id'>
  dailyGoalPlans!: EntityTable<DailyGoalPlan, 'id'>
  intervalProtocols!: EntityTable<IntervalProtocol, 'id'>
  cardioSessions!: EntityTable<CardioSession, 'id'>
  shortcutActionReceipts!: EntityTable<ShortcutActionReceipt, 'id'>
  syncOutbox!: EntityTable<SyncOutboxEvent, 'id'>
  cloudSyncPreferences!: EntityTable<CloudSyncPreference, 'id'>
  localWorkspaces!: EntityTable<LocalWorkspace, 'id'>
  syncConflictAudits!: EntityTable<SyncConflictAudit, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores(versionOneStores)
    this.version(2).stores(versionTwoStores).upgrade(async (transaction) => {
      const now = new Date().toISOString()
      await transaction.table('userProfiles').toCollection().modify((profile) => {
        profile.version ??= 1
        profile.schemaVersion = 2
        profile.updatedAt ??= now
      })
    })
    this.version(3).stores(versionThreeStores).upgrade(async (transaction) => {
      const now = new Date().toISOString()
      const normalizeSource = (source: string) => source === 'imported' ? 'import' : source

      await transaction.table('weightRecords').toCollection().modify((record) => {
        record.localDate ??= toLocalDate(record.measuredAt)
        record.source = normalizeSource(record.source)
        record.schemaVersion = 3
      })
      await transaction.table('waistRecords').toCollection().modify((record) => {
        record.localDate ??= toLocalDate(record.measuredAt)
        record.source = normalizeSource(record.source)
        record.schemaVersion = 3
      })
      await transaction.table('stepRecords').toCollection().modify((record) => {
        record.localDate ??= record.date ?? toLocalDate(record.measuredAt)
        record.measuredAt ??= new Date(`${record.localDate}T12:00:00`).toISOString()
        record.source = normalizeSource(record.source)
        record.schemaVersion = 3
        delete record.date
      })

      const profiles = await transaction.table('userProfiles').toArray()
      for (const profile of profiles) {
        profile.schemaVersion = 3
        profile.updatedAt ??= now
        await transaction.table('userProfiles').put(profile)
        const count = await transaction.table('weightRecords').where('userId').equals(profile.id).count()
        if (count === 0) {
          const measuredAt = profile.createdAt ?? now
          await transaction.table('weightRecords').add({
            id: crypto.randomUUID(),
            userId: profile.id,
            valueKg: profile.currentWeightKg,
            measuredAt,
            localDate: toLocalDate(measuredAt),
            source: 'manual',
            note: 'Başlangıç ölçümü',
            createdAt: measuredAt,
            updatedAt: measuredAt,
            version: 1,
            schemaVersion: 3,
          })
        }
      }
    })
    this.version(4).stores(versionFourStores).upgrade(async (transaction) => {
      const seedVersions = await transaction.table('seedVersions').toArray() as SeedVersion[]
      const seedGroups = new Map<SeedVersion['dataset'], SeedVersion[]>()
      for (const seedVersion of seedVersions) {
        const group = seedGroups.get(seedVersion.dataset) ?? []
        group.push(seedVersion)
        seedGroups.set(seedVersion.dataset, group)
      }
      for (const group of seedGroups.values()) {
        group.sort((left, right) => right.dataVersion - left.dataVersion || right.appliedAt.localeCompare(left.appliedAt))
        await transaction.table('seedVersions').bulkDelete(group.slice(1).map((record) => record.id))
      }

      const tables = ['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'seedVersions']
      for (const tableName of tables) {
        await transaction.table(tableName).toCollection().modify((record) => { record.schemaVersion = 4 })
      }
    })
    this.version(5).stores(versionFiveStores).upgrade(async (transaction) => {
      const now = new Date().toISOString()
      const tables = ['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'seedVersions', 'evidenceReferences', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'muscles', 'equipment', 'exercises', 'exerciseHealthConsiderations', 'exerciseMedia', 'workoutPlans', 'workoutDays', 'workoutExercises', 'workoutSessions', 'workoutSets']
      for (const tableName of tables) {
        await transaction.table(tableName).toCollection().modify((record) => {
          record.schemaVersion = 5
          record.updatedAt ??= now
        })
      }
    })
    this.version(6).stores(versionSixStores).upgrade(async (transaction) => {
      const now = new Date().toISOString()
      const profiles = await transaction.table('userProfiles').filter((profile) => !profile.deletedAt).toArray()
      const preferences = await transaction.table('cloudSyncPreferences').toArray() as CloudSyncPreference[]
      const usedAuthUids = new Set<string>()
      for (const [index, profile] of profiles.entries()) {
        const preference = preferences.find((item) => item.userId === profile.id && item.cloudUserId && !usedAuthUids.has(item.cloudUserId))
        if (preference?.cloudUserId) usedAuthUids.add(preference.cloudUserId)
        const workspace: LocalWorkspace = {
          id: crypto.randomUUID(), ownerType: preference?.cloudUserId ? 'AUTHENTICATED' : 'LOCAL_ONLY', state: index === 0 ? 'ACTIVE' : 'INACTIVE',
          localUserId: profile.id, authUid: preference?.cloudUserId, authEmail: preference?.email,
          createdAt: now, updatedAt: now, version: 1, schemaVersion: 6,
        }
        await transaction.table('localWorkspaces').put(workspace)
      }
      const tables = ['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutPlans', 'workoutDays', 'workoutExercises', 'workoutSessions', 'workoutSets', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions', 'shortcutActionReceipts', 'syncOutbox', 'cloudSyncPreferences']
      for (const tableName of tables) {
        await transaction.table(tableName).toCollection().modify((record) => {
          record.schemaVersion = 6
          record.updatedAt ??= now
        })
      }
    })
  }
}

export const appDb = new FormdaDatabase()

export async function initializeDatabase(database: FormdaDatabase = appDb) {
  if (!database.isOpen()) await database.open()
  return database
}
