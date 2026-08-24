import type { FoodCategory, FoodPreparationState, FoodSourceType, FoodVerificationStatus, MealType, NutrientKey } from '../enums'
import type { EntityMetadata } from './common'

export type NutrientProfile = Record<NutrientKey, number | null>
export type NutrientKnownState = Record<NutrientKey, boolean>

export interface ServingDefinition {
  id: string
  label: string
  grams: number
  source: 'USDA_PORTION' | 'MANUFACTURER' | 'USER_DEFINED' | 'RECIPE_YIELD' | 'INGREDIENT_WEIGHT_BASIS'
  sourceId?: string
}

export interface NutritionSnapshot {
  nutrients: NutrientProfile
  known: NutrientKnownState
  calculationVersion: number
  weightBasis: 'FOOD_GRAMS' | 'COOKED_RECIPE_YIELD' | 'RECIPE_SERVING'
}

export interface Food extends EntityMetadata {
  userId?: string
  name: string
  normalizedName: string
  aliases: string[]
  brand?: string
  category: FoodCategory
  sourceType: FoodSourceType
  sourceId?: string
  sourceUrl?: string
  sourceRelease?: string
  sourceDescription?: string
  verificationStatus: FoodVerificationStatus
  dataVersion: number
  servingDefinitions: ServingDefinition[]
  nutrientsPer100g: NutrientProfile
  preparationState: FoodPreparationState
  active: boolean
}

export interface Recipe extends EntityMetadata {
  userId?: string
  familyId: string
  recipeVersion: number
  name: string
  normalizedName: string
  category: FoodCategory
  description: string
  servings: number
  totalCookedWeightG?: number
  preparation: string
  sourceType: 'TURKISH_CURATED' | 'USER_DEFINED'
  source?: string
  sourceUrl?: string
  verificationStatus: FoodVerificationStatus
  active: boolean
}

export interface RecipeIngredient extends EntityMetadata {
  recipeId: string
  foodId: string
  amountG: number
  preparationState?: FoodPreparationState
  sortOrder: number
}

export interface FavoriteFood extends EntityMetadata {
  userId: string
  itemType: 'FOOD' | 'RECIPE'
  itemId: string
}

export interface Meal extends EntityMetadata {
  userId: string
  localDate: string
  mealType: MealType
  eatenAt: string
  notes?: string
}

export interface MealItem extends EntityMetadata {
  mealId: string
  foodId?: string
  recipeId?: string
  foodVersion?: number
  recipeVersion?: number
  displayNameSnapshot: string
  amountG: number
  servingSnapshot?: ServingDefinition
  nutritionSnapshot: NutritionSnapshot
  source: 'FOOD' | 'RECIPE' | 'MEAL_COPY'
}

export interface NutritionFormulaAudit {
  equationName: 'MIFFLIN_ST_JEOR_1990'
  equationVersion: 1
  equationSourceId: string
  inputs: { weightKg: number; heightCm: number; ageYears: number; sex: 'female' | 'male'; activityLevel: NutritionActivityLevel }
  restingEnergyKcal: number
  activityMultiplier: number
  maintenanceEnergyKcal: number
  caloriePolicy: 'MAINTENANCE' | 'PROGRAM_DEFICIT' | 'MANUAL_OVERRIDE'
  proteinRuleId: string
  programRuleVersion: number
}

export type NutritionActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high'

export interface DailyNutritionTarget extends EntityMetadata {
  userId: string
  localDate: string
  energyKcal: number
  proteinG: number
  carbohydrateG: number
  fatG: number
  fiberG?: number
  sodiumMg?: number
  source: 'RECOMMENDATION' | 'MANUAL_OVERRIDE'
  ruleVersion: number
  formulaAudit?: NutritionFormulaAudit
}

export interface NutritionSettings extends EntityMetadata {
  userId: string
  activityLevel: NutritionActivityLevel
  manualEnergyKcal?: number
  manualProteinG?: number
  manualCarbohydrateG?: number
  manualFatG?: number
  manualFiberG?: number
  manualSodiumMg?: number
}

export interface DailyNutritionTotal {
  nutrients: NutrientProfile
  knownItemCounts: Record<NutrientKey, number>
  itemCount: number
  completeness: Record<NutrientKey, number>
}
