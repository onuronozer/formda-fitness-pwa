import type { EntityMetadata } from './common'

export interface Food extends EntityMetadata { name: string; state: 'raw' | 'cooked' | 'not_applicable'; servingGrams: number }
export interface Recipe extends EntityMetadata { name: string; currentVersionId: string }
export interface RecipeVersion extends EntityMetadata { recipeId: string; versionNumber: number; yieldGrams: number }
export interface RecipeIngredient extends EntityMetadata { recipeVersionId: string; foodId: string; grams: number }
export interface Meal extends EntityMetadata { userId: string; eatenAt: string }
export interface MealItem extends EntityMetadata { mealId: string; foodId?: string; recipeVersionId?: string; grams: number }
