import { z } from 'zod'
import { FOOD_CATEGORIES, FOOD_PREPARATION_STATES, FOOD_SOURCE_TYPES, FOOD_VERIFICATION_STATUSES, MEAL_TYPES, NUTRIENT_KEYS } from '../domain/enums'
import { entityMetadataSchema } from './profileSchemas'

const timestamp = z.string().datetime({ offset: true })
const localDate = z.string().date()
const userId = z.string().uuid()
const finiteNonNegative = z.number().finite().min(0)
const nutrientLimits = {
  energyKcal: 2_000, proteinG: 100, carbohydrateG: 100, fatG: 100, fiberG: 100, sugarG: 100, saturatedFatG: 100,
  sodiumMg: 100_000, potassiumMg: 100_000, calciumMg: 100_000, ironMg: 10_000, cholesterolMg: 10_000,
} as const

const nutrientShape = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, finiteNonNegative.max(nutrientLimits[key]).nullable()])) as unknown as Record<(typeof NUTRIENT_KEYS)[number], z.ZodType<number | null>>
const knownShape = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, z.boolean()])) as unknown as Record<(typeof NUTRIENT_KEYS)[number], z.ZodBoolean>
const metadata = entityMetadataSchema.extend({ id: z.string().min(1).max(120) })

export const nutrientProfileSchema = z.object(nutrientShape)
export const nutrientKnownStateSchema = z.object(knownShape)
export const servingDefinitionSchema = z.object({
  id: z.string().min(1).max(120), label: z.string().trim().min(1).max(80), grams: z.number().finite().positive().max(100_000),
  source: z.enum(['USDA_PORTION', 'MANUFACTURER', 'USER_DEFINED', 'RECIPE_YIELD', 'INGREDIENT_WEIGHT_BASIS']), sourceId: z.string().max(120).optional(),
})
export const nutritionSnapshotSchema = z.object({
  nutrients: nutrientProfileSchema, known: nutrientKnownStateSchema, calculationVersion: z.number().int().positive(),
  weightBasis: z.enum(['FOOD_GRAMS', 'COOKED_RECIPE_YIELD', 'RECIPE_SERVING']),
})

export const foodSchema = metadata.extend({
  userId: userId.optional(), name: z.string().trim().min(1).max(140), normalizedName: z.string().min(1).max(180), aliases: z.array(z.string().trim().min(1).max(100)).max(20),
  brand: z.string().trim().min(1).max(100).optional(), category: z.enum(FOOD_CATEGORIES), sourceType: z.enum(FOOD_SOURCE_TYPES), sourceId: z.string().max(120).optional(),
  sourceUrl: z.string().url().optional(), sourceRelease: z.string().max(80).optional(), sourceDescription: z.string().max(300).optional(), verificationStatus: z.enum(FOOD_VERIFICATION_STATUSES),
  dataVersion: z.number().int().positive(), servingDefinitions: z.array(servingDefinitionSchema).max(20), nutrientsPer100g: nutrientProfileSchema,
  preparationState: z.enum(FOOD_PREPARATION_STATES), active: z.boolean(),
}).superRefine((food, context) => {
  if (food.sourceType === 'USER_DEFINED' && !food.userId) context.addIssue({ code: 'custom', path: ['userId'], message: 'Kullanıcı gıdası için profil gerekli.' })
  if (food.verificationStatus === 'VERIFIED' && (!food.sourceId || !food.sourceUrl)) context.addIssue({ code: 'custom', path: ['verificationStatus'], message: 'Doğrulanmış gıda kaynak kimliği ve URL taşımalı.' })
})

export const recipeSchema = metadata.extend({
  userId: userId.optional(), familyId: z.string().min(1).max(120), recipeVersion: z.number().int().positive(), name: z.string().trim().min(1).max(140),
  normalizedName: z.string().min(1).max(180), category: z.enum(FOOD_CATEGORIES), description: z.string().trim().min(1).max(240), servings: z.number().int().positive().max(100),
  totalCookedWeightG: z.number().finite().positive().max(100_000).optional(), preparation: z.string().trim().min(1).max(600), sourceType: z.enum(['TURKISH_CURATED', 'USER_DEFINED']),
  source: z.string().max(200).optional(), sourceUrl: z.string().url().optional(), verificationStatus: z.enum(FOOD_VERIFICATION_STATUSES), active: z.boolean(),
}).superRefine((recipe, context) => {
  if (recipe.sourceType === 'USER_DEFINED' && !recipe.userId) context.addIssue({ code: 'custom', path: ['userId'], message: 'Kullanıcı tarifi için profil gerekli.' })
})

export const recipeIngredientSchema = metadata.extend({ recipeId: z.string().min(1).max(120), foodId: z.string().min(1).max(120), amountG: z.number().finite().positive().max(100_000), preparationState: z.enum(FOOD_PREPARATION_STATES).optional(), sortOrder: z.number().int().min(0).max(500) })
export const favoriteFoodSchema = metadata.extend({ userId, itemType: z.enum(['FOOD', 'RECIPE']), itemId: z.string().min(1).max(120) })
export const mealSchema = metadata.extend({ userId, localDate, mealType: z.enum(MEAL_TYPES), eatenAt: timestamp, notes: z.string().trim().max(500).optional() })
export const mealItemSchema = metadata.extend({
  mealId: z.string().min(1).max(120), foodId: z.string().min(1).max(120).optional(), recipeId: z.string().min(1).max(120).optional(), foodVersion: z.number().int().positive().optional(), recipeVersion: z.number().int().positive().optional(),
  displayNameSnapshot: z.string().trim().min(1).max(160), amountG: z.number().finite().positive().max(100_000), servingSnapshot: servingDefinitionSchema.optional(), nutritionSnapshot: nutritionSnapshotSchema,
  source: z.enum(['FOOD', 'RECIPE', 'MEAL_COPY']),
}).superRefine((item, context) => {
  if (Number(Boolean(item.foodId)) + Number(Boolean(item.recipeId)) !== 1) context.addIssue({ code: 'custom', path: ['foodId'], message: 'Öğün öğesi tek bir gıda veya tarif göstermeli.' })
})

const nutritionFormulaAuditSchema = z.object({
  equationName: z.literal('MIFFLIN_ST_JEOR_1990'), equationVersion: z.literal(1), equationSourceId: z.string().min(1),
  inputs: z.object({ weightKg: z.number().finite().positive(), heightCm: z.number().finite().positive(), ageYears: z.number().int().positive(), sex: z.enum(['female', 'male']), activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high']) }),
  restingEnergyKcal: z.number().finite().positive(), activityMultiplier: z.number().finite().positive(), maintenanceEnergyKcal: z.number().finite().positive(),
  caloriePolicy: z.enum(['MAINTENANCE', 'PROGRAM_DEFICIT', 'MANUAL_OVERRIDE']), proteinRuleId: z.string().min(1), programRuleVersion: z.number().int().positive(),
})

const positiveTarget = z.number().finite().positive().max(100_000)
export const dailyNutritionTargetSchema = metadata.extend({
  userId, localDate, energyKcal: positiveTarget, proteinG: positiveTarget, carbohydrateG: positiveTarget, fatG: positiveTarget,
  fiberG: positiveTarget.optional(), sodiumMg: positiveTarget.optional(), source: z.enum(['RECOMMENDATION', 'MANUAL_OVERRIDE']), ruleVersion: z.number().int().positive(), formulaAudit: nutritionFormulaAuditSchema.optional(),
})
export const nutritionSettingsSchema = metadata.extend({
  userId, activityLevel: z.enum(['sedentary', 'light', 'moderate', 'high']), manualEnergyKcal: positiveTarget.optional(), manualProteinG: positiveTarget.optional(),
  manualCarbohydrateG: positiveTarget.optional(), manualFatG: positiveTarget.optional(), manualFiberG: positiveTarget.optional(), manualSodiumMg: positiveTarget.optional(),
})

export const foodAmountSchema = z.number().finite().positive().max(100_000)
