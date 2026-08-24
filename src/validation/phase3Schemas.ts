import { z } from 'zod'
import { HEALTH_CONDITION_TYPES, HEALTH_GATE_STATUSES, PAIN_LEVELS, PRIMARY_GOALS, WORKOUT_SESSION_STATUSES } from '../domain/enums'
import { entityMetadataSchema } from './profileSchemas'

const id = z.string().uuid()
const timestamp = z.string().datetime({ offset: true })

export const dailyHealthCheckSchema = entityMetadataSchema.extend({
  userId: id, localDate: z.string().date(), checkedAt: timestamp, revision: z.number().int().positive(), supersedesId: id.optional(),
  overallPain: z.number().int().min(0).max(10), energyLevel: z.number().int().min(1).max(5), unusualSymptoms: z.boolean(),
  initialHighBpDetected: z.boolean().default(false), repeatBpRequired: z.boolean().default(false),
  repeatSystolic: z.number().int().min(70).max(250).optional(), repeatDiastolic: z.number().int().min(40).max(150).optional(),
  initialBpMeasuredAt: timestamp.optional(), repeatBpMeasuredAt: timestamp.optional(),
})
export const dailyHealthResponseSchema = entityMetadataSchema.extend({
  userId: id, healthCheckId: id, conditionType: z.enum(HEALTH_CONDITION_TYPES), questionKey: z.string().min(1).max(80),
  booleanValue: z.boolean().optional(), numberValue: z.number().finite().optional(),
}).refine((value) => (value.booleanValue === undefined) !== (value.numberValue === undefined), 'Yanıt tek bir değer taşımalı.')
export const preWorkoutCheckSchema = entityMetadataSchema.extend({
  userId: id, workoutSessionId: id.optional(), dailyHealthCheckId: id, checkedAt: timestamp, localDate: z.string().date(),
  conditionChangedSinceDailyCheck: z.boolean(), newSymptoms: z.boolean(), resultingHealthStatus: z.enum(HEALTH_GATE_STATUSES), healthEvaluationId: id.optional(),
  bladderChange: z.boolean().default(false), bowelChange: z.boolean().default(false), saddleNumbness: z.boolean().default(false), progressiveMotorWeakness: z.boolean().default(false),
})
export const workoutPlanSchema = entityMetadataSchema.extend({
  userId: id, name: z.string().min(1).max(120), goal: z.enum(PRIMARY_GOALS), daysPerWeek: z.number().int().min(1).max(7),
  healthStatusAtGeneration: z.enum(HEALTH_GATE_STATUSES), active: z.boolean(),
  generatedByRuleVersion: z.number().int().positive().optional(), validatedAt: timestamp.optional(),
  validationResult: z.object({ valid: z.boolean(), errors: z.array(z.string()), warnings: z.array(z.string()) }).optional(),
})
export const workoutDaySchema = entityMetadataSchema.extend({ workoutPlanId: id, dayIndex: z.number().int().min(0), scheduledWeekday: z.number().int().min(0).max(6), name: z.string().min(1).max(80) })
export const workoutExerciseSchema = entityMetadataSchema.extend({
  workoutDayId: id, exerciseId: z.string().min(1), order: z.number().int().min(0), targetSets: z.number().int().min(1).max(10),
  targetRepMin: z.number().int().min(1).max(100), targetRepMax: z.number().int().min(1).max(100), targetRpe: z.number().min(1).max(10).optional(),
  restSeconds: z.number().int().min(0).max(600), modified: z.boolean(),
})
export const workoutSessionSchema = entityMetadataSchema.extend({
  userId: id, workoutDayId: id, startedAt: timestamp, completedAt: timestamp.optional(), localDate: z.string().date(), healthEvaluationId: id,
  preWorkoutCheckId: id.optional(), status: z.enum(WORKOUT_SESSION_STATUSES),
})
export const workoutSetSchema = entityMetadataSchema.extend({
  workoutSessionId: id, exerciseId: z.string().min(1), setNumber: z.number().int().positive(), weightKg: z.number().min(0).max(1000).optional(),
  reps: z.number().int().min(0).max(1000).optional(), rpe: z.number().min(1).max(10).optional(), completed: z.boolean(),
  painDuringSet: z.enum(PAIN_LEVELS).optional(), painBodyArea: z.string().max(80).optional(),
})
