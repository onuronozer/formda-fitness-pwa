import { describe, expect, it } from 'vitest'
import { NUTRIENT_KEYS } from '../domain/enums'
import type { NutrientProfile, Recipe, RecipeIngredient } from '../domain/models'
import { createEntityMetadata } from '../domain/models'
import { formatNutrition, NutritionCalculationService } from '../services/NutritionCalculationService'

const service = new NutritionCalculationService()
const nutrients = (changes: Partial<NutrientProfile> = {}): NutrientProfile => ({
  energyKcal: 200, proteinG: 10, carbohydrateG: 20, fatG: 8, fiberG: 4, sugarG: 2, saturatedFatG: 1, sodiumMg: 120,
  potassiumMg: 300, calciumMg: 50, ironMg: 2, cholesterolMg: 0, ...changes,
})
const recipe = (changes: Partial<Recipe> = {}): Recipe => ({
  ...createEntityMetadata(), familyId: 'family-a', recipeVersion: 1, name: 'Test', normalizedName: 'test', category: 'main_dish', description: 'Test recipe', servings: 2,
  preparation: 'Karıştır.', sourceType: 'USER_DEFINED', verificationStatus: 'USER_ENTERED', active: true, userId: '11111111-1111-4111-8111-111111111111', ...changes,
})
const ingredient = (amountG: number): RecipeIngredient => ({ ...createEntityMetadata(), recipeId: 'recipe-a', foodId: 'food-a', amountG, sortOrder: 0 })

describe('NutritionCalculationService', () => {
  it.each([[100, 200], [50, 100], [250, 500], [12.5, 25]])('scales %s g deterministically', (grams, kcal) => {
    expect(service.calculateFood({ nutrientsPer100g: nutrients() }, grams).nutrients.energyKcal).toBe(kcal)
  })

  it('calculates multiple nutrients at full precision', () => {
    const result = service.calculateFood({ nutrientsPer100g: nutrients() }, 33.3).nutrients
    expect(result.energyKcal).toBeCloseTo(66.6); expect(result.proteinG).toBeCloseTo(3.33); expect(result.sodiumMg).toBeCloseTo(39.96)
  })

  it('keeps missing nutrients unknown and preserves a real zero', () => {
    const result = service.calculateFood({ nutrientsPer100g: nutrients({ sodiumMg: null, cholesterolMg: 0 }) }, 100)
    expect(result.nutrients.sodiumMg).toBeNull(); expect(result.known.sodiumMg).toBe(false)
    expect(result.nutrients.cholesterolMg).toBe(0); expect(result.known.cholesterolMg).toBe(true)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid amount %s', (amount) => {
    expect(() => service.calculateFood({ nutrientsPer100g: nutrients() }, amount)).toThrow()
  })

  it('accepts a large but bounded amount', () => expect(service.calculateFood({ nutrientsPer100g: nutrients() }, 10_000).nutrients.proteinG).toBe(1_000))

  it('rounds only in the display formatter', () => {
    const exact = service.calculateFood({ nutrientsPer100g: nutrients() }, 33.333).nutrients.proteinG!
    expect(exact).toBeCloseTo(3.3333, 8); expect(formatNutrition.grams(exact)).toBe('3,3')
  })

  it('calculates one and multiple ingredient recipes', () => {
    const one = service.calculateRecipe(recipe(), [{ ingredient: ingredient(100), food: { nutrientsPer100g: nutrients() } }])
    expect(one.total.nutrients.energyKcal).toBe(200); expect(one.perServing.nutrients.energyKcal).toBe(100)
    const multiple = service.calculateRecipe(recipe(), [{ ingredient: ingredient(100), food: { nutrientsPer100g: nutrients() } }, { ingredient: ingredient(50), food: { nutrientsPer100g: nutrients({ energyKcal: 100 }) } }])
    expect(multiple.total.nutrients.energyKcal).toBe(250)
  })

  it('uses cooked yield for per-100g and gram consumption', () => {
    const value = service.calculateRecipe(recipe({ totalCookedWeightG: 400 }), [{ ingredient: ingredient(200), food: { nutrientsPer100g: nutrients() } }])
    expect(value.per100g?.nutrients.energyKcal).toBe(100)
    expect(service.calculateRecipeConsumption(value, recipe({ totalCookedWeightG: 400 }), { grams: 250 }).snapshot.nutrients.energyKcal).toBe(250)
  })

  it('requires cooked yield before accepting recipe grams', () => {
    const value = service.calculateRecipe(recipe(), [{ ingredient: ingredient(100), food: { nutrientsPer100g: nutrients() } }])
    expect(() => service.calculateRecipeConsumption(value, recipe(), { grams: 100 })).toThrow('RECIPE_COOKED_YIELD_REQUIRED_FOR_GRAMS')
  })

  it('reports nutrient-by-nutrient daily completeness', () => {
    const values = [service.calculateFood({ nutrientsPer100g: nutrients() }, 100), service.calculateFood({ nutrientsPer100g: nutrients({ sodiumMg: null }) }, 100)]
    const total = service.dailyTotal(values)
    expect(total.nutrients.energyKcal).toBe(400); expect(total.completeness.energyKcal).toBe(1)
    expect(total.nutrients.sodiumMg).toBe(120); expect(total.completeness.sodiumMg).toBe(0.5)
    expect(Object.keys(total.completeness)).toEqual([...NUTRIENT_KEYS])
  })
})
