import { createEntityMetadata, type FavoriteFood, type Food } from '../../domain/models'
import type { FoodCategory } from '../../domain/enums'
import { normalizeTurkish } from '../../utils/normalizeTurkish'
import { foodSchema } from '../../validation/nutritionSchemas'
import { ensureNutritionSeed } from '../../seed/seedService'
import { SyncQueue } from '../../sync'
import { appDb, type FormdaDatabase } from '../database'

export interface FoodSearchFilters { query?: string; category?: FoodCategory; limit?: number }

export class NutritionRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async searchFoods(userId: string, filters: FoodSearchFilters = {}) {
    await ensureNutritionSeed(this.db)
    const query = normalizeTurkish(filters.query ?? '')
    const foods = await this.db.foods.filter((food) => food.active && (!food.userId || food.userId === userId)).toArray()
    return foods.filter((food) =>
      (!filters.category || food.category === filters.category)
      && (!query || [food.normalizedName, ...food.aliases.map(normalizeTurkish), normalizeTurkish(food.brand ?? '')].some((value) => value.includes(query))),
    ).sort((left, right) => left.name.localeCompare(right.name, 'tr')).slice(0, filters.limit ?? 60)
  }

  async getFood(id: string, userId?: string) {
    await ensureNutritionSeed(this.db)
    const food = await this.db.foods.get(id)
    return food?.active && (!food.userId || food.userId === userId) ? food : undefined
  }

  async saveCustomFood(userId: string, input: Omit<Food, keyof ReturnType<typeof createEntityMetadata> | 'userId' | 'sourceType' | 'verificationStatus' | 'dataVersion' | 'normalizedName' | 'active'> & { id?: string }) {
    const existing = input.id ? await this.db.foods.get(input.id) : undefined
    if (existing && existing.userId !== userId) throw new Error('FOOD_OWNERSHIP_MISMATCH')
    const now = new Date().toISOString()
    const food = foodSchema.parse({
      ...(existing ?? createEntityMetadata(now)), ...input, id: existing?.id ?? input.id ?? crypto.randomUUID(), userId, normalizedName: normalizeTurkish(input.name),
      sourceType: 'USER_DEFINED', verificationStatus: 'USER_ENTERED', dataVersion: 1, active: true,
      createdAt: existing?.createdAt ?? now, updatedAt: now, version: existing ? existing.version + 1 : 1,
    }) as Food
    await this.db.transaction('rw', [this.db.foods, this.db.syncOutbox], async () => { await this.db.foods.put(food); await this.queue.enqueue(userId, 'foods', food as Food & Record<string, unknown>) })
    return food
  }

  async deleteCustomFood(userId: string, foodId: string) {
    const current = await this.db.foods.get(foodId)
    if (!current || current.userId !== userId || current.sourceType !== 'USER_DEFINED') throw new Error('FOOD_OWNERSHIP_MISMATCH')
    const now = new Date().toISOString()
    const deleted: Food = { ...current, active: false, deletedAt: now, updatedAt: now, version: current.version + 1 }
    await this.db.transaction('rw', [this.db.foods, this.db.syncOutbox], async () => { await this.db.foods.put(deleted); await this.queue.enqueue(userId, 'foods', deleted as Food & Record<string, unknown>) })
  }

  async listRecipes(userId: string, query = '') {
    await ensureNutritionSeed(this.db)
    const normalized = normalizeTurkish(query)
    return (await this.db.recipes.filter((recipe) => recipe.active && (!recipe.userId || recipe.userId === userId)).toArray())
      .filter((recipe) => !normalized || recipe.normalizedName.includes(normalized))
      .sort((left, right) => left.name.localeCompare(right.name, 'tr'))
  }

  async getRecipe(id: string, userId?: string) {
    await ensureNutritionSeed(this.db)
    const recipe = await this.db.recipes.get(id)
    return recipe?.active && (!recipe.userId || recipe.userId === userId) ? recipe : undefined
  }

  async getRecipeIngredients(recipeId: string) { await ensureNutritionSeed(this.db); return this.db.recipeIngredients.where('recipeId').equals(recipeId).sortBy('sortOrder') }

  async listFavorites(userId: string) { return this.db.favoriteFoods.where('userId').equals(userId).filter((favorite) => !favorite.deletedAt).toArray() }

  async toggleFavorite(userId: string, itemType: FavoriteFood['itemType'], itemId: string) {
    const existing = await this.db.favoriteFoods.where('[userId+itemType+itemId]').equals([userId, itemType, itemId]).first()
    const now = new Date().toISOString()
    const favorite: FavoriteFood = existing
      ? { ...existing, deletedAt: existing.deletedAt ? undefined : now, updatedAt: now, version: existing.version + 1 }
      : { ...createEntityMetadata(now), userId, itemType, itemId }
    await this.db.transaction('rw', [this.db.favoriteFoods, this.db.syncOutbox], async () => { await this.db.favoriteFoods.put(favorite); await this.queue.enqueue(userId, 'favoriteFoods', favorite as FavoriteFood & Record<string, unknown>) })
    return favorite
  }

}
