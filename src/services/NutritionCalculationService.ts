import { NUTRIENT_KEYS } from '../domain/enums'
import type { DailyNutritionTotal, Food, NutrientKnownState, NutrientProfile, NutritionSnapshot, Recipe, RecipeIngredient } from '../domain/models'
import { NUTRITION_CALCULATION_VERSION } from '../config/nutrition'
import { foodAmountSchema } from '../validation/nutritionSchemas'

const emptyNutrients = (): NutrientProfile => Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, null])) as NutrientProfile
const emptyKnown = (): NutrientKnownState => Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, false])) as NutrientKnownState

export interface RecipeCalculation {
  total: NutritionSnapshot
  perServing: NutritionSnapshot
  per100g?: NutritionSnapshot
  ingredientWeightG: number
  referenceWeightG: number
}

export class NutritionCalculationService {
  calculateFood(food: Pick<Food, 'nutrientsPer100g'>, consumedGrams: number): NutritionSnapshot {
    const grams = foodAmountSchema.parse(consumedGrams)
    return this.scale(food.nutrientsPer100g, grams / 100, 'FOOD_GRAMS')
  }

  calculateRecipe(recipe: Pick<Recipe, 'servings' | 'totalCookedWeightG'>, ingredients: Array<{ ingredient: Pick<RecipeIngredient, 'amountG'>; food: Pick<Food, 'nutrientsPer100g'> }>): RecipeCalculation {
    if (!ingredients.length) throw new Error('RECIPE_INGREDIENTS_REQUIRED')
    const ingredientSnapshots = ingredients.map(({ ingredient, food }) => this.calculateFood(food, ingredient.amountG))
    const total = this.sum(ingredientSnapshots, recipe.totalCookedWeightG ? 'COOKED_RECIPE_YIELD' : 'RECIPE_SERVING')
    const ingredientWeightG = ingredients.reduce((sum, item) => sum + foodAmountSchema.parse(item.ingredient.amountG), 0)
    const referenceWeightG = recipe.totalCookedWeightG ?? ingredientWeightG
    return {
      total,
      perServing: this.scaleSnapshot(total, 1 / recipe.servings, 'RECIPE_SERVING'),
      per100g: recipe.totalCookedWeightG ? this.scaleSnapshot(total, 100 / recipe.totalCookedWeightG, 'COOKED_RECIPE_YIELD') : undefined,
      ingredientWeightG,
      referenceWeightG,
    }
  }

  calculateRecipeConsumption(calculation: RecipeCalculation, recipe: Pick<Recipe, 'servings' | 'totalCookedWeightG'>, input: { grams?: number; servings?: number }) {
    if (input.grams !== undefined) {
      if (!recipe.totalCookedWeightG) throw new Error('RECIPE_COOKED_YIELD_REQUIRED_FOR_GRAMS')
      const grams = foodAmountSchema.parse(input.grams)
      return { amountG: grams, snapshot: this.scaleSnapshot(calculation.total, grams / recipe.totalCookedWeightG, 'COOKED_RECIPE_YIELD') }
    }
    const servings = foodAmountSchema.parse(input.servings ?? 0)
    return {
      amountG: calculation.referenceWeightG / recipe.servings * servings,
      snapshot: this.scaleSnapshot(calculation.total, servings / recipe.servings, 'RECIPE_SERVING'),
    }
  }

  sum(snapshots: NutritionSnapshot[], weightBasis: NutritionSnapshot['weightBasis'] = 'FOOD_GRAMS'): NutritionSnapshot {
    const nutrients = emptyNutrients(); const known = emptyKnown()
    for (const key of NUTRIENT_KEYS) {
      const values = snapshots.filter((snapshot) => snapshot.known[key]).map((snapshot) => snapshot.nutrients[key] as number)
      known[key] = values.length === snapshots.length && snapshots.length > 0
      nutrients[key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null
    }
    return { nutrients, known, calculationVersion: NUTRITION_CALCULATION_VERSION, weightBasis }
  }

  dailyTotal(snapshots: NutritionSnapshot[]): DailyNutritionTotal {
    const nutrients = emptyNutrients()
    const knownItemCounts = Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0])) as Record<(typeof NUTRIENT_KEYS)[number], number>
    const completeness = { ...knownItemCounts }
    for (const key of NUTRIENT_KEYS) {
      const values = snapshots.filter((snapshot) => snapshot.known[key]).map((snapshot) => snapshot.nutrients[key] as number)
      knownItemCounts[key] = values.length
      nutrients[key] = values.length ? values.reduce((sum, value) => sum + value, 0) : null
      completeness[key] = snapshots.length ? values.length / snapshots.length : 0
    }
    return { nutrients, knownItemCounts, itemCount: snapshots.length, completeness }
  }

  private scale(nutrientsPer100g: NutrientProfile, ratio: number, weightBasis: NutritionSnapshot['weightBasis']): NutritionSnapshot {
    const nutrients = emptyNutrients(); const known = emptyKnown()
    for (const key of NUTRIENT_KEYS) {
      const value = nutrientsPer100g[key]
      known[key] = value !== null
      nutrients[key] = value === null ? null : value * ratio
    }
    return { nutrients, known, calculationVersion: NUTRITION_CALCULATION_VERSION, weightBasis }
  }

  private scaleSnapshot(snapshot: NutritionSnapshot, ratio: number, weightBasis: NutritionSnapshot['weightBasis']): NutritionSnapshot {
    const nutrients = emptyNutrients()
    for (const key of NUTRIENT_KEYS) nutrients[key] = snapshot.nutrients[key] === null ? null : snapshot.nutrients[key] * ratio
    return { nutrients, known: { ...snapshot.known }, calculationVersion: NUTRITION_CALCULATION_VERSION, weightBasis }
  }
}

export const nutritionCalculationService = new NutritionCalculationService()

export const formatNutrition = {
  kcal: (value: number | null | undefined) => value === null || value === undefined ? '--' : Math.round(value).toLocaleString('tr-TR'),
  grams: (value: number | null | undefined) => value === null || value === undefined ? '--' : value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }),
  milligrams: (value: number | null | undefined) => value === null || value === undefined ? '--' : Math.round(value).toLocaleString('tr-TR'),
}
