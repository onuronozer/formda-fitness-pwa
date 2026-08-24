import { createEntityMetadata, type Recipe, type RecipeIngredient } from '../domain/models'
import type { FoodCategory } from '../domain/enums'
import { appDb, type FormdaDatabase } from '../db/database'
import { NutritionRepository } from '../db/repositories'
import { normalizeTurkish } from '../utils/normalizeTurkish'
import { recipeIngredientSchema, recipeSchema } from '../validation/nutritionSchemas'
import { SyncQueue } from '../sync'
import { NutritionCalculationService } from './NutritionCalculationService'

export interface RecipeInput {
  name: string
  category: FoodCategory
  description: string
  servings: number
  totalCookedWeightG?: number
  preparation: string
  ingredients: Array<{ foodId: string; amountG: number; preparationState?: RecipeIngredient['preparationState'] }>
}

export class RecipeService {
  private readonly repository: NutritionRepository
  private readonly queue: SyncQueue
  private readonly calculation = new NutritionCalculationService()
  constructor(private readonly db: FormdaDatabase = appDb) { this.repository = new NutritionRepository(db); this.queue = new SyncQueue(db) }

  async create(userId: string, input: RecipeInput) { return this.saveVersion(userId, input) }

  async edit(userId: string, recipeId: string, input: RecipeInput) {
    const current = await this.db.recipes.get(recipeId)
    if (!current || current.userId !== userId || current.sourceType !== 'USER_DEFINED') throw new Error('RECIPE_OWNERSHIP_MISMATCH')
    return this.saveVersion(userId, input, current)
  }

  async delete(userId: string, recipeId: string) {
    const current = await this.db.recipes.get(recipeId)
    if (!current || current.userId !== userId || current.sourceType !== 'USER_DEFINED') throw new Error('RECIPE_OWNERSHIP_MISMATCH')
    const now = new Date().toISOString()
    const deleted: Recipe = { ...current, active: false, deletedAt: now, updatedAt: now, version: current.version + 1 }
    await this.db.transaction('rw', [this.db.recipes, this.db.syncOutbox], async () => { await this.db.recipes.put(deleted); await this.queue.enqueue(userId, 'recipes', deleted as Recipe & Record<string, unknown>) })
  }

  async detail(userId: string, recipeId: string) {
    const recipe = await this.repository.getRecipe(recipeId, userId)
    if (!recipe) return undefined
    const ingredients = await this.repository.getRecipeIngredients(recipe.id)
    const foods = await Promise.all(ingredients.map((ingredient) => this.repository.getFood(ingredient.foodId, userId)))
    if (foods.some((food) => !food)) throw new Error('RECIPE_FOOD_REFERENCE_INVALID')
    const pairs = ingredients.map((ingredient, index) => ({ ingredient, food: foods[index]! }))
    return { recipe, ingredients: pairs, calculation: this.calculation.calculateRecipe(recipe, pairs) }
  }

  private async saveVersion(userId: string, input: RecipeInput, current?: Recipe) {
    const now = new Date().toISOString()
    const recipe = recipeSchema.parse({
      ...createEntityMetadata(now), userId, familyId: current?.familyId ?? crypto.randomUUID(), recipeVersion: (current?.recipeVersion ?? 0) + 1,
      name: input.name, normalizedName: normalizeTurkish(input.name), category: input.category, description: input.description, servings: input.servings,
      totalCookedWeightG: input.totalCookedWeightG, preparation: input.preparation, sourceType: 'USER_DEFINED', source: 'Kullanıcı tarifi', verificationStatus: 'USER_ENTERED', active: true,
    }) as Recipe
    if (!input.ingredients.length) throw new Error('RECIPE_INGREDIENTS_REQUIRED')
    const foods = await Promise.all(input.ingredients.map((ingredient) => this.repository.getFood(ingredient.foodId, userId)))
    if (foods.some((food) => !food)) throw new Error('RECIPE_FOOD_REFERENCE_INVALID')
    const ingredients = input.ingredients.map((ingredient, sortOrder) => recipeIngredientSchema.parse({ ...createEntityMetadata(now), recipeId: recipe.id, ...ingredient, sortOrder }) as RecipeIngredient)
    this.calculation.calculateRecipe(recipe, ingredients.map((ingredient, index) => ({ ingredient, food: foods[index]! })))

    await this.db.transaction('rw', [this.db.recipes, this.db.recipeIngredients, this.db.syncOutbox], async () => {
      if (current) {
        const retired = { ...current, active: false, updatedAt: now, version: current.version + 1 }
        await this.db.recipes.put(retired)
        await this.queue.enqueue(userId, 'recipes', retired as Recipe & Record<string, unknown>)
      }
      await this.db.recipes.add(recipe)
      await this.db.recipeIngredients.bulkAdd(ingredients)
      await this.queue.enqueue(userId, 'recipes', recipe as Recipe & Record<string, unknown>)
      for (const ingredient of ingredients) await this.queue.enqueue(userId, 'recipeIngredients', ingredient as RecipeIngredient & Record<string, unknown>)
    })
    return { recipe, ingredients }
  }
}
