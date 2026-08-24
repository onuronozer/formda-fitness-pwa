import { z } from 'zod'
import { HEALTH_CONDITION_TYPES } from '../domain/enums'

export const dailyHealthInputSchema = z.object({
  localDate: z.string().date(),
  overallPain: z.coerce.number().int().min(0).max(10),
  energyLevel: z.coerce.number().int().min(1).max(5),
  unusualSymptoms: z.boolean(),
  repeatSystolic: z.coerce.number().int().min(70).max(250).optional(),
  repeatDiastolic: z.coerce.number().int().min(40).max(150).optional(),
  responses: z.array(z.object({
    conditionType: z.enum(HEALTH_CONDITION_TYPES),
    questionKey: z.string().min(1).max(80),
    booleanValue: z.boolean().optional(),
    numberValue: z.coerce.number().optional(),
  }).refine((value) => (value.booleanValue === undefined) !== (value.numberValue === undefined), 'Yanıt tek bir değer taşımalı.')),
}).refine((value) => (value.repeatSystolic === undefined) === (value.repeatDiastolic === undefined), 'Tekrar ölçümünün iki değeri de gerekli.').superRefine((value, context) => {
  const measured = value.responses.find((response) => response.conditionType === 'hypertension' && response.questionKey === 'measured_bp_today')?.booleanValue === true
  if (!measured) return
  const systolic = value.responses.find((response) => response.conditionType === 'hypertension' && response.questionKey === 'systolic')?.numberValue
  const diastolic = value.responses.find((response) => response.conditionType === 'hypertension' && response.questionKey === 'diastolic')?.numberValue
  if (systolic === undefined || systolic < 70 || systolic > 250 || diastolic === undefined || diastolic < 40 || diastolic > 150) context.addIssue({ code: 'custom', message: 'Tansiyon ölçümünü kontrol et.' })
})

export const preWorkoutInputSchema = z.object({
  localDate: z.string().date(),
  dailyHealthCheckId: z.string().min(1),
  workoutSessionId: z.string().optional(),
  conditionChangedSinceDailyCheck: z.boolean(),
  newSymptoms: z.boolean(),
  bladderChange: z.boolean().default(false),
  bowelChange: z.boolean().default(false),
  saddleNumbness: z.boolean().default(false),
  progressiveMotorWeakness: z.boolean().default(false),
})
