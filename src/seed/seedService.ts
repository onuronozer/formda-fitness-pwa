import { createEntityMetadata } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'
import { HEALTH_RULES_VERSION } from '../rules/health'
import { EXERCISE_SEED_VERSION } from '../config/workouts'
import { clinicalEvidenceSeed, CLINICAL_EVIDENCE_SEED_VERSION } from './evidenceSeed'
import { intervalProtocolSeed } from './intervalSeed'
import { INTERVAL_RULE_VERSION } from '../config/phase3b'
import { NUTRITION_SEED_VERSION } from '../config/nutrition'
import { EXERCISE_DIFFICULTIES, MOVEMENT_PATTERNS } from '../domain/enums'

const exerciseSeedTasks = new WeakMap<FormdaDatabase, Promise<void>>()
const nutritionSeedTasks = new WeakMap<FormdaDatabase, Promise<void>>()
const CORE_EXERCISE_COUNTS = { exercises: 35, muscles: 16, equipment: 9 } as const

export async function ensureSeedVersions(database: FormdaDatabase = appDb) {
  const existing = await database.seedVersions.where('dataset').equals('health_rules').first()
  if (!existing || existing.dataVersion < HEALTH_RULES_VERSION) {
    const now = new Date().toISOString()
    await database.seedVersions.put({
      ...(existing ? { ...existing, updatedAt: now, version: existing.version + 1 } : createEntityMetadata(now)),
      dataset: 'health_rules',
      dataVersion: HEALTH_RULES_VERSION,
      appliedAt: now,
    })
  }
  const evidenceVersion = await database.seedVersions.where('dataset').equals('evidence').first()
  if (!evidenceVersion || evidenceVersion.dataVersion < CLINICAL_EVIDENCE_SEED_VERSION || await database.evidenceReferences.where('id').anyOf(clinicalEvidenceSeed.map((item) => item.id)).count() < clinicalEvidenceSeed.length) {
    const now = new Date().toISOString()
    await database.transaction('rw', [database.evidenceReferences, database.seedVersions], async () => {
      await database.evidenceReferences.bulkPut(clinicalEvidenceSeed)
      await database.seedVersions.put({
        ...(evidenceVersion ? { ...evidenceVersion, updatedAt: now, version: evidenceVersion.version + 1 } : createEntityMetadata(now)),
        dataset: 'evidence', dataVersion: CLINICAL_EVIDENCE_SEED_VERSION, appliedAt: now,
      })
    })
  }
  const intervalVersion = await database.seedVersions.where('dataset').equals('interval_protocols').first()
  if (!intervalVersion || intervalVersion.dataVersion < INTERVAL_RULE_VERSION || await database.intervalProtocols.count() < intervalProtocolSeed.length) {
    const now = new Date().toISOString()
    await database.transaction('rw', [database.intervalProtocols, database.seedVersions], async () => {
      await database.intervalProtocols.bulkPut(intervalProtocolSeed)
      await database.seedVersions.put({
        ...(intervalVersion ? { ...intervalVersion, updatedAt: now, version: intervalVersion.version + 1 } : createEntityMetadata(now)),
        dataset: 'interval_protocols', dataVersion: INTERVAL_RULE_VERSION, appliedAt: now,
      })
    })
  }
}

export function ensureExerciseSeed(database: FormdaDatabase = appDb) {
  const activeTask = exerciseSeedTasks.get(database)
  if (activeTask) return activeTask

  const task = ensureExerciseSeedUnlocked(database).finally(() => {
    if (exerciseSeedTasks.get(database) === task) exerciseSeedTasks.delete(database)
  })
  exerciseSeedTasks.set(database, task)
  return task
}

async function ensureExerciseSeedUnlocked(database: FormdaDatabase) {
  const existing = await database.seedVersions.where('dataset').equals('exercises').first()
  if (existing && existing.dataVersion >= EXERCISE_SEED_VERSION && await hasValidExerciseSeed(database)) return

  const seed = await import('./exerciseSeed')
  const now = new Date().toISOString()
  await database.transaction('rw', [database.muscles, database.equipment, database.exercises, database.exerciseHealthConsiderations, database.exerciseMedia, database.evidenceReferences, database.seedVersions], async () => {
    await Promise.all([
      database.muscles.clear(), database.equipment.clear(), database.exercises.clear(), database.exerciseHealthConsiderations.clear(), database.exerciseMedia.clear(),
    ])
    await database.muscles.bulkPut(seed.muscleSeed)
    await database.equipment.bulkPut(seed.equipmentSeed)
    await database.exercises.bulkPut(seed.exerciseSeed)
    await database.exerciseHealthConsiderations.bulkPut(seed.exerciseHealthConsiderationSeed)
    await database.exerciseMedia.bulkPut(seed.exerciseMediaSeed)
    await database.evidenceReferences.bulkPut(seed.exerciseEvidenceSeed)
    await database.seedVersions.put({
      ...(existing ? { ...existing, updatedAt: now, version: existing.version + 1 } : createEntityMetadata(now)),
      dataset: 'exercises',
      dataVersion: EXERCISE_SEED_VERSION,
      appliedAt: now,
    })
  })
}

async function hasValidExerciseSeed(database: FormdaDatabase) {
  const [exercises, muscles, equipment] = await Promise.all([
    database.exercises.toArray(), database.muscles.toArray(), database.equipment.toArray(),
  ])
  if (exercises.length !== CORE_EXERCISE_COUNTS.exercises || muscles.length !== CORE_EXERCISE_COUNTS.muscles || equipment.length !== CORE_EXERCISE_COUNTS.equipment) return false

  const hasValidCatalogEntry = (item: { id: unknown; name: unknown; slug: unknown; active: unknown; seedVersion: unknown }) =>
    typeof item.id === 'string' && item.id.length > 0
    && typeof item.name === 'string' && item.name.length > 0
    && typeof item.slug === 'string' && item.slug.length > 0
    && typeof item.active === 'boolean'
    && typeof item.seedVersion === 'number' && Number.isFinite(item.seedVersion)
  if (!muscles.every(hasValidCatalogEntry) || !equipment.every(hasValidCatalogEntry)) return false

  const muscleIds = new Set(muscles.map((item) => item.id))
  const equipmentIds = new Set(equipment.map((item) => item.id))
  const exerciseIds = new Set(exercises.map((item) => item.id))
  const movementPatterns = new Set<string>(MOVEMENT_PATTERNS)
  const difficulties = new Set<string>(EXERCISE_DIFFICULTIES)
  const arrayFields = ['equipmentIds', 'primaryMuscleIds', 'secondaryMuscleIds', 'instructions', 'commonMistakes', 'progressionExerciseIds', 'regressionExerciseIds', 'substitutionExerciseIds'] as const

  return exercises.every((exercise) =>
    hasValidCatalogEntry(exercise)
    && movementPatterns.has(exercise.movementPattern)
    && difficulties.has(exercise.difficulty)
    && typeof exercise.unilateral === 'boolean'
    && typeof exercise.active === 'boolean'
    && arrayFields.every((field) => Array.isArray(exercise[field]) && exercise[field].every((value) => typeof value === 'string'))
    && exercise.primaryMuscleIds.length > 0
    && exercise.instructions.length > 0
    && exercise.primaryMuscleIds.every((id) => muscleIds.has(id))
    && exercise.secondaryMuscleIds.every((id) => muscleIds.has(id))
    && exercise.equipmentIds.every((id) => equipmentIds.has(id))
    && [...exercise.progressionExerciseIds, ...exercise.regressionExerciseIds, ...exercise.substitutionExerciseIds].every((id) => exerciseIds.has(id)),
  )
}

export function ensureNutritionSeed(database: FormdaDatabase = appDb) {
  const activeTask = nutritionSeedTasks.get(database)
  if (activeTask) return activeTask
  const task = ensureNutritionSeedUnlocked(database).finally(() => { if (nutritionSeedTasks.get(database) === task) nutritionSeedTasks.delete(database) })
  nutritionSeedTasks.set(database, task)
  return task
}

async function ensureNutritionSeedUnlocked(database: FormdaDatabase) {
  const [foodVersion, recipeVersion] = await Promise.all([
    database.seedVersions.where('dataset').equals('foods').first(), database.seedVersions.where('dataset').equals('recipes').first(),
  ])
  const staticFoods = await database.foods.filter((food) => !food.userId).toArray()
  const staticRecipes = await database.recipes.filter((recipe) => !recipe.userId).toArray()
  const recipeIds = new Set(staticRecipes.map((recipe) => recipe.id))
  const ingredients = recipeIds.size ? await database.recipeIngredients.filter((ingredient) => recipeIds.has(ingredient.recipeId)).toArray() : []
  const foodIds = new Set(staticFoods.map((food) => food.id))
  const valid = foodVersion?.dataVersion === NUTRITION_SEED_VERSION && recipeVersion?.dataVersion === NUTRITION_SEED_VERSION
    && staticFoods.length >= 100 && staticRecipes.length >= 40 && ingredients.length > 0
    && staticFoods.every((food) => food.verificationStatus !== 'VERIFIED' || Boolean(food.sourceId && food.sourceUrl))
    && ingredients.every((ingredient) => recipeIds.has(ingredient.recipeId) && foodIds.has(ingredient.foodId) && ingredient.amountG > 0)
  if (valid) return

  const [{ foodSeed }, { recipeSeed, recipeIngredientSeed }] = await Promise.all([import('./foodSeed.generated'), import('./recipeSeed')])
  const now = new Date().toISOString()
  await database.transaction('rw', [database.foods, database.recipes, database.recipeIngredients, database.seedVersions], async () => {
    const oldRecipeIds = await database.recipes.filter((recipe) => !recipe.userId).primaryKeys()
    if (oldRecipeIds.length) await database.recipeIngredients.where('recipeId').anyOf(oldRecipeIds).delete()
    await database.foods.filter((food) => !food.userId).delete()
    await database.recipes.filter((recipe) => !recipe.userId).delete()
    await database.foods.bulkPut(foodSeed)
    await database.recipes.bulkPut(recipeSeed)
    await database.recipeIngredients.bulkPut(recipeIngredientSeed)
    for (const [dataset, existing] of [['foods', foodVersion], ['recipes', recipeVersion]] as const) {
      await database.seedVersions.put({
        ...(existing ? { ...existing, updatedAt: now, version: existing.version + 1 } : createEntityMetadata(now)),
        dataset, dataVersion: NUTRITION_SEED_VERSION, appliedAt: now,
      })
    }
  })
}
