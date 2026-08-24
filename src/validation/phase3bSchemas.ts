import { z } from 'zod'
import { CARDIO_SESSION_STATUSES, HEALTH_GATE_STATUSES, HYDRATION_TARGET_SOURCES, INTERVAL_DIFFICULTIES, INTERVAL_MODALITIES, STEP_GOAL_MODES, SYNC_STATUSES, WATER_SOURCES } from '../domain/enums'
import { DAILY_GOAL_CONFIG, HYDRATION_CONFIG } from '../config/phase3b'
import { entityMetadataSchema } from './profileSchemas'

const id = z.string().uuid()
const timestamp = z.string().datetime({ offset: true })
const localDate = z.string().date()
export const waterAmountSchema = z.coerce.number().int().min(HYDRATION_CONFIG.amountMl.min).max(HYDRATION_CONFIG.amountMl.max)
export const hydrationTargetAmountSchema = z.coerce.number().int().min(HYDRATION_CONFIG.targetMl.min).max(HYDRATION_CONFIG.targetMl.max)

export const waterRecordSchema = entityMetadataSchema.extend({ userId: id, amountMl: waterAmountSchema, consumedAt: timestamp, localDate, source: z.enum(WATER_SOURCES) })
export const dailyHydrationTargetSchema = entityMetadataSchema.extend({ userId: id, localDate, targetMl: hydrationTargetAmountSchema, source: z.enum(HYDRATION_TARGET_SOURCES), ruleVersion: z.number().int().positive() })
export const dailyGoalSettingsSchema = entityMetadataSchema.extend({
  userId: id, stepMode: z.enum(STEP_GOAL_MODES), manualStepTarget: z.number().int().min(DAILY_GOAL_CONFIG.stepTarget.min).max(DAILY_GOAL_CONFIG.stepTarget.max).optional(),
  currentStepBaseline: z.number().int().min(DAILY_GOAL_CONFIG.stepTarget.min).max(DAILY_GOAL_CONFIG.stepTarget.max),
  hydrationMode: z.enum(['program', 'manual', 'fluid_restriction']), manualHydrationTargetMl: hydrationTargetAmountSchema.optional(),
}).superRefine((value, context) => {
  if (value.stepMode === 'manual' && value.manualStepTarget === undefined) context.addIssue({ code: 'custom', path: ['manualStepTarget'], message: 'Manuel adım hedefi gerekli.' })
  if (value.hydrationMode === 'manual' && value.manualHydrationTargetMl === undefined) context.addIssue({ code: 'custom', path: ['manualHydrationTargetMl'], message: 'Manuel su hedefi gerekli.' })
})
export const dailyGoalPlanSchema = entityMetadataSchema.extend({
  userId: id, localDate, hydrationTargetMl: hydrationTargetAmountSchema, stepTarget: z.number().int().min(DAILY_GOAL_CONFIG.stepTarget.min).max(DAILY_GOAL_CONFIG.stepTarget.max),
  workoutTarget: z.enum(['workout', 'rest', 'unavailable']), workoutDayId: id.optional(), cardioTarget: z.enum(['interval', 'none']), intervalProtocolId: z.string().min(1).optional(),
  generatedByVersion: z.number().int().positive(), healthStatusAtGeneration: z.enum(HEALTH_GATE_STATUSES), reasons: z.array(z.string().min(1)).min(1), generatedAt: timestamp,
})
export const intervalProtocolSchema = entityMetadataSchema.extend({
  name: z.string().min(1).max(100), modality: z.enum(INTERVAL_MODALITIES), difficulty: z.enum(INTERVAL_DIFFICULTIES), warmupSeconds: z.number().int().min(0).max(3_600),
  workSeconds: z.number().int().positive().max(3_600), recoverySeconds: z.number().int().min(0).max(3_600), rounds: z.number().int().min(1).max(100), cooldownSeconds: z.number().int().min(0).max(3_600),
  intensityLabel: z.string().min(1).max(80), allowedWhenModified: z.boolean(), active: z.boolean(), ruleVersion: z.number().int().positive(),
})
export const cardioSessionSchema = entityMetadataSchema.extend({
  userId: id, protocolId: z.string().min(1), localDate, startedAt: timestamp, completedAt: timestamp.optional(), roundsCompleted: z.number().int().min(0).max(100),
  status: z.enum(CARDIO_SESSION_STATUSES), perceivedDifficulty: z.number().int().min(1).max(5).optional(), feedback: z.string().max(300).optional(),
})
export const shortcutActionSchema = z.object({ action: z.literal('water'), ml: waterAmountSchema })
export const shortcutActionReceiptSchema = entityMetadataSchema.extend({ userId: id, actionId: z.string().min(8).max(200), action: z.literal('water'), amountMl: waterAmountSchema, processedAt: timestamp })

export const syncEntityTypeSchema = z.enum(['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutPlans', 'workoutDays', 'workoutExercises', 'workoutSessions', 'workoutSets', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalSettings', 'dailyGoalPlans', 'cardioSessions'])
export const syncOutboxEventSchema = entityMetadataSchema.extend({ userId: id, entityType: syncEntityTypeSchema, entityId: z.string().min(1), operation: z.enum(['upsert', 'delete']), payload: z.record(z.string(), z.unknown()), status: z.enum(SYNC_STATUSES), attempts: z.number().int().min(0), nextAttemptAt: timestamp, lastErrorCode: z.string().max(80).optional(), idempotencyKey: z.string().min(1).max(300) })
export const cloudSyncPreferenceSchema = entityMetadataSchema.extend({ userId: id, enabled: z.boolean(), cloudUserId: z.string().min(1).optional(), email: z.string().email().optional(), clientId: z.string().uuid(), lastSyncedAt: timestamp.optional(), lastPulledAt: timestamp.optional(), syncStatus: z.enum([...SYNC_STATUSES, 'offline', 'disabled', 'verification_required', 'authentication_required', 'deletion_partial']), syncError: z.string().max(160).optional() })
