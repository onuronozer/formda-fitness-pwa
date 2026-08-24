import { createEntityMetadata, type Meal, type MealItem, type ServingDefinition } from '../domain/models'
import type { MealType } from '../domain/enums'
import { appDb, type FormdaDatabase } from '../db/database'
import { NutritionRepository } from '../db/repositories'
import { mealItemSchema, mealSchema } from '../validation/nutritionSchemas'
import { SyncQueue } from '../sync'
import { NutritionCalculationService } from './NutritionCalculationService'
import { RecipeService } from './RecipeService'

export class MealService {
  private readonly repository: NutritionRepository
  private readonly recipes: RecipeService
  private readonly queue: SyncQueue
  private readonly calculation = new NutritionCalculationService()
  constructor(private readonly db: FormdaDatabase = appDb) { this.repository = new NutritionRepository(db); this.recipes = new RecipeService(db); this.queue = new SyncQueue(db) }

  async getDay(userId: string, localDate: string) {
    const meals = await this.db.meals.where('[userId+localDate]').equals([userId, localDate]).filter((meal) => !meal.deletedAt).sortBy('eatenAt')
    const items = meals.length ? await this.db.mealItems.where('mealId').anyOf(meals.map((meal) => meal.id)).filter((item) => !item.deletedAt).toArray() : []
    return meals.map((meal) => ({ meal, items: items.filter((item) => item.mealId === meal.id) }))
  }

  async getDailyTotal(userId: string, localDate: string) {
    const day = await this.getDay(userId, localDate)
    return this.calculation.dailyTotal(day.flatMap((entry) => entry.items.map((item) => item.nutritionSnapshot)))
  }

  async getRangeTotals(userId: string, startDate: string, endDate: string) {
    const meals = await this.db.meals.where('[userId+localDate]').between([userId, startDate], [userId, endDate], true, true).filter((meal) => !meal.deletedAt).toArray()
    const items = meals.length ? await this.db.mealItems.where('mealId').anyOf(meals.map((meal) => meal.id)).filter((item) => !item.deletedAt).toArray() : []
    const mealsByDate = new Map<string, string[]>()
    for (const meal of meals) mealsByDate.set(meal.localDate, [...(mealsByDate.get(meal.localDate) ?? []), meal.id])
    return [...mealsByDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([localDate, mealIds]) => ({
      localDate,
      total: this.calculation.dailyTotal(items.filter((item) => mealIds.includes(item.mealId)).map((item) => item.nutritionSnapshot)),
    }))
  }

  async addFood(userId: string, localDate: string, mealType: MealType, foodId: string, amountG: number, servingSnapshot?: ServingDefinition, source: MealItem['source'] = 'FOOD') {
    const food = await this.repository.getFood(foodId, userId)
    if (!food) throw new Error('FOOD_NOT_FOUND')
    const meal = await this.getOrCreateMeal(userId, localDate, mealType)
    const item = mealItemSchema.parse({
      ...createEntityMetadata(), mealId: meal.id, foodId: food.id, foodVersion: food.version, displayNameSnapshot: food.name, amountG,
      servingSnapshot, nutritionSnapshot: this.calculation.calculateFood(food, amountG), source,
    }) as MealItem
    await this.persistItem(userId, item)
    return item
  }

  async addRecipe(userId: string, localDate: string, mealType: MealType, recipeId: string, input: { grams?: number; servings?: number }, source: MealItem['source'] = 'RECIPE') {
    const detail = await this.recipes.detail(userId, recipeId)
    if (!detail) throw new Error('RECIPE_NOT_FOUND')
    const meal = await this.getOrCreateMeal(userId, localDate, mealType)
    const consumption = this.calculation.calculateRecipeConsumption(detail.calculation, detail.recipe, input)
    const servingCount = input.servings ?? (detail.recipe.totalCookedWeightG && input.grams ? input.grams / detail.recipe.totalCookedWeightG * detail.recipe.servings : undefined)
    const servingSnapshot: ServingDefinition | undefined = servingCount === undefined ? undefined : {
      id: `recipe-serving-${detail.recipe.id}-v${detail.recipe.recipeVersion}`, label: `${servingCount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} porsiyon`, grams: consumption.amountG,
      source: detail.recipe.totalCookedWeightG ? 'RECIPE_YIELD' : 'INGREDIENT_WEIGHT_BASIS', sourceId: detail.recipe.id,
    }
    const item = mealItemSchema.parse({
      ...createEntityMetadata(), mealId: meal.id, recipeId: detail.recipe.id, recipeVersion: detail.recipe.recipeVersion, displayNameSnapshot: detail.recipe.name,
      amountG: consumption.amountG, servingSnapshot, nutritionSnapshot: consumption.snapshot, source,
    }) as MealItem
    await this.persistItem(userId, item)
    return item
  }

  async updateItem(userId: string, itemId: string, input: { amountG?: number; servings?: number }) {
    const current = await this.requireOwnedItem(userId, itemId)
    let replacement: MealItem
    if (current.foodId) {
      const food = await this.repository.getFood(current.foodId, userId)
      if (!food || input.amountG === undefined) throw new Error('FOOD_NOT_FOUND')
      replacement = { ...current, amountG: input.amountG, foodVersion: food.version, servingSnapshot: undefined, nutritionSnapshot: this.calculation.calculateFood(food, input.amountG), updatedAt: new Date().toISOString(), version: current.version + 1 }
    } else {
      const detail = await this.recipes.detail(userId, current.recipeId!)
      if (!detail) throw new Error('RECIPE_NOT_FOUND')
      const consumption = this.calculation.calculateRecipeConsumption(detail.calculation, detail.recipe, input)
      const servingCount = input.servings ?? (detail.recipe.totalCookedWeightG && input.amountG ? input.amountG / detail.recipe.totalCookedWeightG * detail.recipe.servings : undefined)
      const servingSnapshot: ServingDefinition | undefined = servingCount === undefined ? undefined : { id: `recipe-serving-${detail.recipe.id}-v${detail.recipe.recipeVersion}`, label: `${servingCount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} porsiyon`, grams: consumption.amountG, source: detail.recipe.totalCookedWeightG ? 'RECIPE_YIELD' : 'INGREDIENT_WEIGHT_BASIS', sourceId: detail.recipe.id }
      replacement = { ...current, amountG: consumption.amountG, recipeVersion: detail.recipe.recipeVersion, servingSnapshot, nutritionSnapshot: consumption.snapshot, updatedAt: new Date().toISOString(), version: current.version + 1 }
    }
    const parsed = mealItemSchema.parse(replacement) as MealItem
    await this.persistItem(userId, parsed)
    return parsed
  }

  async deleteItem(userId: string, itemId: string) {
    const current = await this.requireOwnedItem(userId, itemId); const now = new Date().toISOString()
    const deleted = { ...current, deletedAt: now, updatedAt: now, version: current.version + 1 }
    await this.persistItem(userId, deleted)
  }

  async deleteMeal(userId: string, mealId: string) {
    const meal = await this.db.meals.get(mealId)
    if (!meal || meal.userId !== userId) throw new Error('MEAL_OWNERSHIP_MISMATCH')
    const now = new Date().toISOString(); const deletedMeal = { ...meal, deletedAt: now, updatedAt: now, version: meal.version + 1 }
    const items = await this.db.mealItems.where('mealId').equals(mealId).filter((item) => !item.deletedAt).toArray()
    await this.db.transaction('rw', [this.db.meals, this.db.mealItems, this.db.syncOutbox], async () => {
      await this.db.meals.put(deletedMeal); await this.queue.enqueue(userId, 'meals', deletedMeal as Meal & Record<string, unknown>)
      for (const item of items) { const deleted = { ...item, deletedAt: now, updatedAt: now, version: item.version + 1 }; await this.db.mealItems.put(deleted); await this.queue.enqueue(userId, 'mealItems', deleted as MealItem & Record<string, unknown>) }
    })
  }

  async recent(userId: string, limit = 8) {
    const meals = await this.db.meals.where('userId').equals(userId).filter((meal) => !meal.deletedAt).toArray()
    const items = meals.length ? await this.db.mealItems.where('mealId').anyOf(meals.map((meal) => meal.id)).filter((item) => !item.deletedAt).toArray() : []
    items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
    const seen = new Set<string>()
    return items.filter((item) => { const key = item.foodId ? `f:${item.foodId}` : `r:${item.recipeId}`; if (seen.has(key)) return false; seen.add(key); return true }).slice(0, limit)
  }

  async copyMeal(userId: string, sourceMealId: string, targetDate: string, targetMealType: MealType) {
    const source = await this.db.meals.get(sourceMealId)
    if (!source || source.userId !== userId || source.deletedAt) throw new Error('MEAL_NOT_FOUND')
    const items = await this.db.mealItems.where('mealId').equals(source.id).filter((item) => !item.deletedAt).toArray()
    const copied: MealItem[] = []
    for (const item of items) {
      if (item.foodId) copied.push(await this.addFood(userId, targetDate, targetMealType, item.foodId, item.amountG, item.servingSnapshot, 'MEAL_COPY'))
      else if (item.recipeId) {
        const servings = item.servingSnapshot?.label ? Number.parseFloat(item.servingSnapshot.label.replace(',', '.')) : 1
        copied.push(await this.addRecipe(userId, targetDate, targetMealType, item.recipeId, { servings: Number.isFinite(servings) ? servings : 1 }, 'MEAL_COPY'))
      }
    }
    return copied
  }

  private async getOrCreateMeal(userId: string, localDate: string, mealType: MealType) {
    const existing = await this.db.meals.where('[userId+localDate]').equals([userId, localDate]).filter((meal) => meal.mealType === mealType && !meal.deletedAt).first()
    if (existing) return existing
    const meal = mealSchema.parse({ ...createEntityMetadata(), userId, localDate, mealType, eatenAt: new Date().toISOString() }) as Meal
    await this.db.transaction('rw', [this.db.meals, this.db.syncOutbox], async () => { await this.db.meals.add(meal); await this.queue.enqueue(userId, 'meals', meal as Meal & Record<string, unknown>) })
    return meal
  }

  private async persistItem(userId: string, item: MealItem) {
    await this.db.transaction('rw', [this.db.mealItems, this.db.syncOutbox], async () => { await this.db.mealItems.put(item); await this.queue.enqueue(userId, 'mealItems', item as MealItem & Record<string, unknown>) })
  }

  private async requireOwnedItem(userId: string, itemId: string) {
    const item = await this.db.mealItems.get(itemId); const meal = item ? await this.db.meals.get(item.mealId) : undefined
    if (!item || !meal || meal.userId !== userId) throw new Error('MEAL_ITEM_OWNERSHIP_MISMATCH')
    return item
  }
}
