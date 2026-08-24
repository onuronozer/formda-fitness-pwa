import { z } from 'zod'
import { HEALTH_CONDITION_TYPES, HEALTH_GATE_STATUSES } from '../domain/enums'
import { entityMetadataSchema } from './profileSchemas'

export const healthProfileSchema = entityMetadataSchema.extend({ userId: z.string().uuid() })

export const healthConditionSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  healthProfileId: z.string().uuid(),
  conditionType: z.enum(HEALTH_CONDITION_TYPES),
  active: z.boolean(),
  diagnosed: z.boolean().optional(),
  notes: z.string().max(500).optional(),
})

export const conditionAnswerSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  conditionId: z.string().uuid(),
  questionKey: z.string().min(1).max(80),
  booleanValue: z.boolean().optional(),
  numberValue: z.number().finite().optional(),
  stringValue: z.string().max(500).optional(),
}).refine((answer) => [answer.booleanValue, answer.numberValue, answer.stringValue].filter((value) => value !== undefined).length === 1, {
  message: 'Bir cevap yalnızca tek bir değer türü taşımalıdır.',
})

export const healthEvaluationLogSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  evaluatedAt: z.string().datetime({ offset: true }),
  rulesVersion: z.number().int().positive(),
  status: z.enum(HEALTH_GATE_STATUSES),
  triggeredRuleIds: z.array(z.string()),
  reasons: z.array(z.enum(HEALTH_CONDITION_TYPES)),
  debugEntries: z.array(z.object({
    ruleId: z.string(),
    ruleType: z.enum(['EVIDENCE_RULE', 'PRODUCT_SAFETY_RULE', 'PROGRAM_RULE']).optional(),
    evidenceIds: z.array(z.string()).optional(),
    evaluated: z.boolean(),
    matched: z.boolean(),
    outcome: z.enum(HEALTH_GATE_STATUSES),
  })),
  matchedRules: z.array(z.object({
    ruleId: z.string(), ruleType: z.enum(['EVIDENCE_RULE', 'PRODUCT_SAFETY_RULE', 'PROGRAM_RULE']), evidenceIds: z.array(z.string()),
    resultingStatus: z.enum(HEALTH_GATE_STATUSES), evaluatedAt: z.string().datetime({ offset: true }),
  })).default([]),
  attentionLevel: z.enum(['ROUTINE', 'REPEAT_MEASUREMENT', 'MEDICAL_REVIEW', 'URGENT', 'RED_FLAG']).default('ROUTINE'),
  contextType: z.enum(['profile', 'daily', 'pre_workout', 'during_workout']).optional(),
  dailyHealthCheckId: z.string().uuid().optional(),
  preWorkoutCheckId: z.string().uuid().optional(),
})
