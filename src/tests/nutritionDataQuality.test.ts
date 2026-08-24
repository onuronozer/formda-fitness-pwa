import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { NutritionRepository } from '../db/repositories'
import { ensureNutritionSeed } from '../seed/seedService'
import { foodSchema, recipeIngredientSchema, recipeSchema } from '../validation/nutritionSchemas'
import { USER_ID } from './fixtures'

const names: string[] = []
const create = () => { const name = `formda-nutrition-data-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('nutrition seed quality', () => {
  it('contains 122 unique verified USDA foods with provenance', async () => {
    const db = create(); await ensureNutritionSeed(db); const foods = await db.foods.toArray()
    expect(foods).toHaveLength(122); expect(new Set(foods.map((food) => food.id)).size).toBe(foods.length)
    expect(new Set(foods.map((food) => food.normalizedName)).size).toBe(foods.length)
    for (const food of foods) {
      expect(() => foodSchema.parse(food)).not.toThrow()
      expect(food).toMatchObject({ sourceType: 'USDA_FDC', verificationStatus: 'VERIFIED', active: true, dataVersion: 3 })
      expect(food.sourceId).toBeTruthy(); expect(food.sourceUrl).toMatch(/^https:\/\/fdc\.nal\.usda\.gov\//)
      expect(Object.values(food.nutrientsPer100g).every((value) => value === null || Number.isFinite(value))).toBe(true)
      expect(food.servingDefinitions.every((serving) => serving.grams > 0 && serving.source === 'USDA_PORTION')).toBe(true)
    }
    expect(foods.filter((food) => food.nutrientsPer100g.energyKcal !== null).length).toBeGreaterThanOrEqual(120)
    db.close()
  })

  it('contains 40 balanced Turkish recipe formulations with valid references', async () => {
    const db = create(); await ensureNutritionSeed(db)
    const recipes = await db.recipes.toArray(); const ingredients = await db.recipeIngredients.toArray(); const foodIds = new Set(await db.foods.toCollection().primaryKeys())
    expect(recipes).toHaveLength(40); expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(40)
    expect(new Set(recipes.map((recipe) => recipe.category)).size).toBeGreaterThanOrEqual(7)
    for (const recipe of recipes) { expect(() => recipeSchema.parse(recipe)).not.toThrow(); expect(ingredients.some((ingredient) => ingredient.recipeId === recipe.id)).toBe(true) }
    for (const ingredient of ingredients) { expect(() => recipeIngredientSchema.parse(ingredient)).not.toThrow(); expect(foodIds.has(ingredient.foodId)).toBe(true); expect(ingredient.amountG).toBeGreaterThan(0) }
    db.close()
  })

  it.each(['peynir', 'Peynir', 'PEYNİR', 'yogurt', 'YOĞURT', 'cilek', 'ÇİLEK'])('searches Turkish text tolerantly: %s', async (query) => {
    const db = create(); const results = await new NutritionRepository(db).searchFoods(USER_ID, { query })
    expect(results.length).toBeGreaterThan(0); db.close()
  })
})
