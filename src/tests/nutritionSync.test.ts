import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import type { NutrientProfile } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { NutritionRepository, UserRepository } from '../db/repositories'
import { MealService } from '../services/MealService'
import { NutritionTargetService } from '../services/NutritionTargetService'
import { RecipeService } from '../services/RecipeService'
import { WorkspaceService } from '../services/WorkspaceService'
import { SyncService } from '../sync'
import { USER_ID, validProfile } from './fixtures'
import { MemoryCloudAdapter } from './MemoryCloudAdapter'

const names: string[] = []
const create = () => { const name = `formda-nutrition-sync-${crypto.randomUUID()}`; names.push(name); return new FormdaDatabase(name) }
const identity = { uid: 'cloud-user-a', email: 'a@example.test', emailVerified: true }
const nutrients: NutrientProfile = { energyKcal: 120, proteinG: 8, carbohydrateG: 12, fatG: 5, fiberG: null, sugarG: null, saturatedFatG: null, sodiumMg: 100, potassiumMg: null, calciumMg: null, ironMg: null, cholesterolMg: null }
const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, value })
afterEach(async () => { setOnline(true); await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

async function createNutritionData(db: FormdaDatabase) {
  await new UserRepository(db).save({ ...validProfile, sex: 'male' })
  const repository = new NutritionRepository(db)
  const custom = await repository.saveCustomFood(USER_ID, { name: 'Kendi Ürünüm', aliases: [], brand: 'Test', category: 'packaged', servingDefinitions: [], nutrientsPer100g: nutrients, preparationState: 'as_sold' })
  const recipe = await new RecipeService(db).create(USER_ID, { name: 'Kendi Tarifim', category: 'main_dish', description: 'Test tarifi', servings: 2, preparation: 'Karıştır.', ingredients: [{ foodId: custom.id, amountG: 200 }] })
  await repository.toggleFavorite(USER_ID, 'FOOD', custom.id)
  const item = await new MealService(db).addRecipe(USER_ID, '2026-08-24', 'LUNCH', recipe.recipe.id, { servings: 1 })
  await new NutritionTargetService(db).getOrCreate(USER_ID, '2026-08-24')
  return { custom, recipe, item }
}

describe('nutrition cloud sync', () => {
  it('syncs user nutrition records, excludes static seed, and restores relationships', async () => {
    const cloud = new MemoryCloudAdapter(identity); const first = create(); const created = await createNutritionData(first)
    await new WorkspaceService(first).resolveAuthenticated(identity, USER_ID)
    await new SyncService(first, cloud).enable(USER_ID, identity)
    const types = new Set([...cloud.records.values()].map((record) => record.entityType))
    for (const type of ['foods', 'recipes', 'recipeIngredients', 'favoriteFoods', 'meals', 'mealItems', 'dailyNutritionTargets', 'nutritionSettings']) expect(types.has(type as never)).toBe(true)
    expect([...cloud.records.values()].filter((record) => record.entityType === 'foods')).toHaveLength(1)

    const second = create(); const workspace = (await new WorkspaceService(second).resolveAuthenticated(identity)).workspace
    await new SyncService(second, cloud).bootstrap(workspace, identity)
    expect((await second.foods.get(created.custom.id))?.userId).toBe(USER_ID)
    expect((await second.recipeIngredients.where('recipeId').equals(created.recipe.recipe.id).first())?.foodId).toBe(created.custom.id)
    expect((await second.mealItems.get(created.item.id))?.recipeId).toBe(created.recipe.recipe.id)
    first.close(); second.close()
  })

  it('keeps an offline meal write and uploads it after reconnect', async () => {
    const cloud = new MemoryCloudAdapter(identity); const db = create(); await new UserRepository(db).save({ ...validProfile, sex: 'male' })
    const sync = new SyncService(db, cloud); await new WorkspaceService(db).resolveAuthenticated(identity, USER_ID); setOnline(false); await sync.enable(USER_ID, identity)
    const item = await new MealService(db).addFood(USER_ID, '2026-08-24', 'BREAKFAST', 'food-usda-fdc-748967', 100)
    expect(cloud.records.size).toBe(0); setOnline(true); await sync.syncNow(USER_ID)
    expect(cloud.records.get(`mealItems__${item.id}`)?.entityType).toBe('mealItems'); db.close()
  })

  it('syncs nutrition tombstones and keeps custom foods isolated by account', async () => {
    const cloud = new MemoryCloudAdapter(identity); const db = create(); const created = await createNutritionData(db); const sync = new SyncService(db, cloud)
    await new WorkspaceService(db).resolveAuthenticated(identity, USER_ID); await sync.enable(USER_ID, identity)
    await new MealService(db).deleteItem(USER_ID, created.item.id); await sync.syncNow(USER_ID)
    expect(cloud.records.get(`mealItems__${created.item.id}`)?.operation).toBe('delete')
    expect((await new NutritionRepository(db).searchFoods('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { query: 'Kendi Ürünüm' })).some((food) => food.id === created.custom.id)).toBe(false)
    db.close()
  })
})
