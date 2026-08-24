import { differenceInYears, isValid, parseISO } from 'date-fns'
import { z } from 'zod'
import { EXPERIENCE_LEVELS, PRIMARY_GOALS, SEX_VALUES, TRAINING_LOCATIONS } from '../domain/enums'

const isoTimestamp = z.string().datetime({ offset: true })

export const entityMetadataSchema = z.object({
  id: z.string().uuid(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  deletedAt: isoTimestamp.optional(),
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
})

export const birthDateSchema = z.string().refine((value) => {
  const date = parseISO(value)
  if (!isValid(date)) return false
  const age = differenceInYears(new Date(), date)
  return age >= 13 && age <= 100
}, 'Yaş 13 ile 100 arasında olmalı.')

export const userProfileInputSchema = z.object({
  displayName: z.string().trim().min(2, 'İsim en az 2 karakter olmalı.').max(50),
  birthDate: birthDateSchema,
  sex: z.enum(SEX_VALUES),
  heightCm: z.coerce.number().min(120, 'Boy en az 120 cm olmalı.').max(230, 'Boy en fazla 230 cm olabilir.'),
  currentWeightKg: z.coerce.number().min(30, 'Kilo en az 30 kg olmalı.').max(350, 'Kilo en fazla 350 kg olabilir.'),
  targetWeightKg: z.coerce.number().min(30, 'Hedef kilo en az 30 kg olmalı.').max(350, 'Hedef kilo en fazla 350 kg olabilir.'),
  waistCm: z.coerce.number().min(40).max(250).optional(),
  primaryGoal: z.enum(PRIMARY_GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  trainingDaysPerWeek: z.coerce.number().int().min(2, 'En az 2 gün seç.').max(4, 'Bu sürüm en fazla 4 günü destekliyor.'),
  trainingLocation: z.enum(TRAINING_LOCATIONS),
  availableEquipment: z.array(z.enum(['bodyweight', 'dumbbells', 'resistance_bands', 'machines'])).max(4),
})

export const userProfileSchema = entityMetadataSchema.extend({
  ...userProfileInputSchema.shape,
  trainingDaysPerWeek: z.coerce.number().int().min(1).max(7),
})

export const bloodPressureSchema = z.string()
  .regex(/^\d{2,3}\/\d{2,3}$/, 'Tansiyon 120/80 biçiminde olmalı.')
  .transform((value) => {
    const [systolic, diastolic] = value.split('/').map(Number)
    return { systolic, diastolic }
  })
  .refine(({ systolic, diastolic }) => systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150, 'Tansiyon değeri beklenen aralığın dışında.')

export type UserProfileInput = z.infer<typeof userProfileInputSchema>
