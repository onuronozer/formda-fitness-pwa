import { z } from 'zod'
import { conditionAnswerSchema, healthConditionSchema, healthEvaluationLogSchema, healthProfileSchema } from './healthSchemas'
import { stepRecordSchema, waistRecordSchema, weightRecordSchema } from './measurementSchemas'
import { dailyHealthCheckSchema, dailyHealthResponseSchema, preWorkoutCheckSchema, workoutDaySchema, workoutExerciseSchema, workoutPlanSchema, workoutSessionSchema, workoutSetSchema } from './phase3Schemas'
import { entityMetadataSchema, userProfileSchema } from './profileSchemas'
import { cardioSessionSchema, cloudSyncPreferenceSchema, dailyGoalPlanSchema, dailyGoalSettingsSchema, dailyHydrationTargetSchema, waterRecordSchema } from './phase3bSchemas'

export const BACKUP_SCHEMA_VERSION = 5 as const
export const PHASE_THREE_BACKUP_SCHEMA_VERSION = 4 as const
export const PHASE_TWO_BACKUP_SCHEMA_VERSION = 3 as const
export const LEGACY_BACKUP_SCHEMA_VERSION = 2 as const

const phaseTwoUserData = {
  userProfiles: z.array(userProfileSchema), healthProfiles: z.array(healthProfileSchema), healthConditions: z.array(healthConditionSchema),
  conditionAnswers: z.array(conditionAnswerSchema), healthEvaluationLogs: z.array(healthEvaluationLogSchema),
  weightRecords: z.array(weightRecordSchema), waistRecords: z.array(waistRecordSchema), stepRecords: z.array(stepRecordSchema),
}

export const backupPayloadSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION), exportedAt: z.string().datetime({ offset: true }), appVersion: z.string().min(1),
  seedManifest: z.object({ exercises: z.number().int().positive() }),
  userData: z.object({
    ...phaseTwoUserData,
    dailyHealthChecks: z.array(dailyHealthCheckSchema), dailyHealthResponses: z.array(dailyHealthResponseSchema), preWorkoutChecks: z.array(preWorkoutCheckSchema),
    workoutPlans: z.array(workoutPlanSchema), workoutDays: z.array(workoutDaySchema), workoutExercises: z.array(workoutExerciseSchema),
    workoutSessions: z.array(workoutSessionSchema), workoutSets: z.array(workoutSetSchema),
    waterRecords: z.array(waterRecordSchema), dailyHydrationTargets: z.array(dailyHydrationTargetSchema), dailyGoalSettings: z.array(dailyGoalSettingsSchema),
    dailyGoalPlans: z.array(dailyGoalPlanSchema), cardioSessions: z.array(cardioSessionSchema), cloudSyncPreferences: z.array(cloudSyncPreferenceSchema),
  }),
})

export const phaseThreeBackupPayloadSchema = z.object({
  schemaVersion: z.literal(PHASE_THREE_BACKUP_SCHEMA_VERSION), exportedAt: z.string().datetime({ offset: true }), appVersion: z.string().min(1),
  seedManifest: z.object({ exercises: z.number().int().positive() }),
  userData: z.object({
    ...phaseTwoUserData,
    dailyHealthChecks: z.array(dailyHealthCheckSchema), dailyHealthResponses: z.array(dailyHealthResponseSchema), preWorkoutChecks: z.array(preWorkoutCheckSchema),
    workoutPlans: z.array(workoutPlanSchema), workoutDays: z.array(workoutDaySchema), workoutExercises: z.array(workoutExerciseSchema),
    workoutSessions: z.array(workoutSessionSchema), workoutSets: z.array(workoutSetSchema),
  }),
})

export const phaseTwoBackupPayloadSchema = z.object({
  schemaVersion: z.literal(PHASE_TWO_BACKUP_SCHEMA_VERSION), exportedAt: z.string().datetime({ offset: true }), appVersion: z.string().min(1),
  userData: z.object(phaseTwoUserData),
})

const legacySource = z.enum(['manual', 'imported'])
const legacySharedUserData = {
  userProfiles: z.array(userProfileSchema), healthProfiles: z.array(healthProfileSchema), healthConditions: z.array(healthConditionSchema),
  conditionAnswers: z.array(conditionAnswerSchema), healthEvaluationLogs: z.array(healthEvaluationLogSchema),
}
const legacyWeightSchema = entityMetadataSchema.extend({ userId: z.string().uuid(), valueKg: z.number().min(30).max(350), measuredAt: z.string().datetime({ offset: true }), source: legacySource, note: z.string().max(500).optional() })
const legacyWaistSchema = entityMetadataSchema.extend({ userId: z.string().uuid(), valueCm: z.number().min(40).max(250), measuredAt: z.string().datetime({ offset: true }), source: legacySource })
const legacyStepSchema = entityMetadataSchema.extend({ userId: z.string().uuid(), stepCount: z.number().int().min(0).max(200_000), date: z.string().date(), source: legacySource })

export const legacyBackupPayloadSchema = z.object({
  schemaVersion: z.literal(LEGACY_BACKUP_SCHEMA_VERSION), exportedAt: z.string().datetime({ offset: true }), appVersion: z.string().min(1),
  userData: z.object({ ...legacySharedUserData, weightRecords: z.array(legacyWeightSchema), waistRecords: z.array(legacyWaistSchema), stepRecords: z.array(legacyStepSchema) }),
})

export const backupImportSchema = z.union([backupPayloadSchema, phaseThreeBackupPayloadSchema, phaseTwoBackupPayloadSchema, legacyBackupPayloadSchema])
export type BackupPayload = z.infer<typeof backupPayloadSchema>
export type PhaseThreeBackupPayload = z.infer<typeof phaseThreeBackupPayloadSchema>
export type PhaseTwoBackupPayload = z.infer<typeof phaseTwoBackupPayloadSchema>
export type LegacyBackupPayload = z.infer<typeof legacyBackupPayloadSchema>
