import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { NutritionRepository, UserRepository } from '../db/repositories'
import type { NutrientProfile } from '../domain/models'
import { MealService } from '../services/MealService'
import { RecipeService } from '../services/RecipeService'
import { USER_ID, validProfile } from './fixtures'

const names: string[] = []
const create = () => { const name = `formda-meals-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
afterEach(async () => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })
const customNutrients: NutrientProfile = { energyKcal: 100, proteinG: 10, carbohydrateG: 5, fatG: 4, fiberG: null, sugarG: null, saturatedFatG: null, sodiumMg: null, potassiumMg: null, calciumMg: null, ironMg: null, cholesterolMg: 0 }

describe('MealService', () => {
  it('creates meals, adds, edits and soft deletes items from daily totals offline', async () => {
    const db = create(); await new UserRepository(db).save(validProfile); Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const service = new MealService(db)
    const item = await service.addFood(USER_ID, '2026-08-24', 'BREAKFAST', 'food-usda-fdc-748967', 100)
    expect((await service.getDay(USER_ID, '2026-08-24'))[0].meal.mealType).toBe('BREAKFAST')
    expect((await service.getDailyTotal(USER_ID, '2026-08-24')).nutrients.energyKcal).toBe(148)
    await service.updateItem(USER_ID, item.id, { amountG: 50 })
    expect((await service.getDailyTotal(USER_ID, '2026-08-24')).nutrients.energyKcal).toBe(74)
    await service.deleteItem(USER_ID, item.id)
    expect((await service.getDailyTotal(USER_ID, '2026-08-24')).itemCount).toBe(0)
    expect((await db.syncOutbox.where('userId').equals(USER_ID).toArray()).some((event) => event.entityType === 'mealItems' && event.operation === 'delete')).toBe(true)
    db.close()
  })

  it.each(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const)('keeps meal type %s', async (mealType) => {
    const db = create(); const service = new MealService(db)
    await service.addFood(USER_ID, '2026-08-24', mealType, 'food-usda-fdc-748967', 50)
    expect((await service.getDay(USER_ID, '2026-08-24'))[0].meal.mealType).toBe(mealType); db.close()
  })

  it('keeps an old meal snapshot unchanged after a custom recipe receives a new version', async () => {
    const db = create(); await new UserRepository(db).save(validProfile); const foods = new NutritionRepository(db); const recipes = new RecipeService(db); const meals = new MealService(db)
    const custom = await foods.saveCustomFood(USER_ID, { name: 'Test Ürün', aliases: [], category: 'other', servingDefinitions: [], nutrientsPer100g: customNutrients, preparationState: 'as_sold' })
    const first = await recipes.create(USER_ID, { name: 'Test Tarif', category: 'main_dish', description: 'İlk sürüm', servings: 2, preparation: 'Karıştır.', ingredients: [{ foodId: custom.id, amountG: 200 }] })
    const item = await meals.addRecipe(USER_ID, '2026-08-24', 'LUNCH', first.recipe.id, { servings: 1 })
    expect(item.nutritionSnapshot.nutrients.energyKcal).toBe(100)
    await recipes.edit(USER_ID, first.recipe.id, { name: 'Test Tarif', category: 'main_dish', description: 'İkinci sürüm', servings: 2, preparation: 'Karıştır.', ingredients: [{ foodId: custom.id, amountG: 400 }] })
    expect((await db.mealItems.get(item.id))?.nutritionSnapshot.nutrients.energyKcal).toBe(100)
    expect((await db.recipes.where('familyId').equals(first.recipe.familyId).toArray()).map((recipe) => recipe.recipeVersion).sort()).toEqual([1, 2])
    db.close()
  })

  it('soft deletes a meal and excludes its items', async () => {
    const db = create(); const service = new MealService(db); await service.addFood(USER_ID, '2026-08-24', 'DINNER', 'food-usda-fdc-748967', 100)
    const meal = (await service.getDay(USER_ID, '2026-08-24'))[0].meal; await service.deleteMeal(USER_ID, meal.id)
    expect(await service.getDay(USER_ID, '2026-08-24')).toHaveLength(0); expect((await service.getDailyTotal(USER_ID, '2026-08-24')).itemCount).toBe(0); db.close()
  })

  it('returns range totals and recent foods in deterministic newest-first order', async () => {
    const db = create(); const service = new MealService(db)
    const first = await service.addFood(USER_ID, '2026-08-23', 'BREAKFAST', 'food-usda-fdc-748967', 100)
    const second = await service.addFood(USER_ID, '2026-08-24', 'BREAKFAST', 'food-usda-fdc-2346396', 50)
    await db.mealItems.update(first.id, { updatedAt: '2026-08-23T08:00:00.000Z' })
    await db.mealItems.update(second.id, { updatedAt: '2026-08-24T08:00:00.000Z' })
    const totals = await service.getRangeTotals(USER_ID, '2026-08-23', '2026-08-24')
    expect(totals.map((entry) => entry.localDate)).toEqual(['2026-08-23', '2026-08-24'])
    expect((await service.recent(USER_ID)).map((item) => item.id)).toEqual([second.id, first.id])
    db.close()
  })

  it('copies a meal by recalculating from the current food version', async () => {
    const db = create(); const foods = new NutritionRepository(db); const service = new MealService(db)
    const custom = await foods.saveCustomFood(USER_ID, { name: 'Sürüm Testi', aliases: [], category: 'packaged', servingDefinitions: [], nutrientsPer100g: customNutrients, preparationState: 'as_sold' })
    const sourceItem = await service.addFood(USER_ID, '2026-08-23', 'BREAKFAST', custom.id, 100)
    await foods.saveCustomFood(USER_ID, { ...custom, name: custom.name, nutrientsPer100g: { ...custom.nutrientsPer100g, energyKcal: 150 }, id: custom.id })
    const sourceMeal = (await db.meals.where('[userId+localDate]').equals([USER_ID, '2026-08-23']).first())!
    const [copied] = await service.copyMeal(USER_ID, sourceMeal.id, '2026-08-24', 'BREAKFAST')
    expect(sourceItem.nutritionSnapshot.nutrients.energyKcal).toBe(100)
    expect(copied.nutritionSnapshot.nutrients.energyKcal).toBe(150)
    expect(copied.source).toBe('MEAL_COPY')
    db.close()
  })

  it('soft deletes user foods and recipes without exposing them in search', async () => {
    const db = create(); const foods = new NutritionRepository(db); const recipes = new RecipeService(db)
    const custom = await foods.saveCustomFood(USER_ID, { name: 'Silinecek Ürün', aliases: [], category: 'other', servingDefinitions: [], nutrientsPer100g: customNutrients, preparationState: 'as_sold' })
    const recipe = await recipes.create(USER_ID, { name: 'Silinecek Tarif', category: 'main_dish', description: 'Test', servings: 1, preparation: 'Karıştır.', ingredients: [{ foodId: custom.id, amountG: 100 }] })
    await recipes.delete(USER_ID, recipe.recipe.id); await foods.deleteCustomFood(USER_ID, custom.id)
    expect((await foods.searchFoods(USER_ID, { query: custom.name })).some((food) => food.id === custom.id)).toBe(false)
    expect((await foods.listRecipes(USER_ID, recipe.recipe.name)).some((item) => item.id === recipe.recipe.id)).toBe(false)
    expect(await db.syncOutbox.filter((event) => event.operation === 'delete').count()).toBe(2)
    db.close()
  })
})
