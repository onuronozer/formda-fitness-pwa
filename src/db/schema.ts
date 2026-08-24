export const LEGACY_DATABASE_NAME = 'formda-local-db'
export const DATABASE_NAME = 'formda-fitness-pwa-local-db'
export const DATABASE_SCHEMA_VERSION = 7

export const versionOneStores = {
  userProfiles: 'id, updatedAt, deletedAt',
  healthProfiles: 'id, userId, updatedAt, deletedAt',
  healthConditions: 'id, userId, healthProfileId, conditionType, active, updatedAt, deletedAt',
  conditionAnswers: 'id, userId, conditionId, [conditionId+questionKey], updatedAt, deletedAt',
  weightRecords: 'id, userId, measuredAt, source, deletedAt',
  waistRecords: 'id, userId, measuredAt, source, deletedAt',
  stepRecords: 'id, userId, date, source, deletedAt',
}

export const versionTwoStores = {
  ...versionOneStores,
  healthEvaluationLogs: 'id, userId, evaluatedAt, status, rulesVersion',
  seedVersions: 'id, dataset, dataVersion, appliedAt',
}

export const versionThreeStores = {
  ...versionTwoStores,
  weightRecords: 'id, userId, measuredAt, localDate, [userId+localDate], [userId+measuredAt], source, deletedAt',
  waistRecords: 'id, userId, measuredAt, localDate, [userId+localDate], [userId+measuredAt], source, deletedAt',
  stepRecords: 'id, userId, measuredAt, localDate, [userId+localDate], [userId+localDate+source], source, deletedAt',
}

export const versionFourStores = {
  ...versionThreeStores,
  seedVersions: 'id, dataset, dataVersion, appliedAt',
  evidenceReferences: 'id, evidenceType, organization, lastReviewedAt',
  dailyHealthChecks: 'id, userId, localDate, checkedAt, [userId+localDate], [userId+checkedAt], revision',
  dailyHealthResponses: 'id, userId, healthCheckId, conditionType, [healthCheckId+questionKey]',
  preWorkoutChecks: 'id, userId, localDate, checkedAt, workoutSessionId, [userId+localDate]',
  muscles: 'id, &slug, active, seedVersion',
  equipment: 'id, &slug, active, seedVersion',
  exercises: 'id, &slug, movementPattern, difficulty, active, seedVersion, *equipmentIds, *primaryMuscleIds, *secondaryMuscleIds',
  exerciseHealthConsiderations: 'id, exerciseId, conditionType, [exerciseId+conditionType], status, reviewed',
  exerciseMedia: 'id, exerciseId, status, provider, [exerciseId+status]',
  workoutPlans: 'id, userId, active, createdAt, [userId+active]',
  workoutDays: 'id, workoutPlanId, dayIndex, scheduledWeekday, [workoutPlanId+dayIndex]',
  workoutExercises: 'id, workoutDayId, exerciseId, order, [workoutDayId+order]',
  workoutSessions: 'id, userId, workoutDayId, localDate, startedAt, status, [userId+localDate]',
  workoutSets: 'id, workoutSessionId, exerciseId, setNumber, [workoutSessionId+exerciseId+setNumber]',
}

export const versionFiveStores = {
  ...versionFourStores,
  waterRecords: 'id, userId, localDate, [userId+localDate], consumedAt, deletedAt',
  dailyHydrationTargets: 'id, userId, localDate, &[userId+localDate], updatedAt',
  dailyGoalSettings: 'id, &userId, updatedAt',
  dailyGoalPlans: 'id, userId, localDate, &[userId+localDate], generatedAt',
  intervalProtocols: 'id, modality, difficulty, active, ruleVersion',
  cardioSessions: 'id, userId, protocolId, localDate, [userId+localDate], startedAt, status, deletedAt',
  shortcutActionReceipts: 'id, userId, &actionId, processedAt',
  syncOutbox: 'id, userId, status, nextAttemptAt, [userId+status], &idempotencyKey',
  cloudSyncPreferences: 'id, &userId, cloudUserId, syncStatus, updatedAt',
}

export const versionSixStores = {
  ...versionFiveStores,
  localWorkspaces: 'id, ownerType, state, &authUid, &localUserId, updatedAt',
  syncConflictAudits: 'id, workspaceId, localUserId, entityType, entityId, resolvedAt, [localUserId+resolvedAt]',
}

export const versionSevenStores = {
  ...versionSixStores,
  foods: 'id, userId, normalizedName, category, sourceType, active, [userId+normalizedName]',
  recipes: 'id, userId, familyId, normalizedName, active, recipeVersion, [userId+normalizedName]',
  recipeIngredients: 'id, recipeId, foodId, sortOrder, [recipeId+sortOrder]',
  favoriteFoods: 'id, userId, itemType, itemId, [userId+itemType], &[userId+itemType+itemId], deletedAt',
  meals: 'id, userId, localDate, [userId+localDate], mealType, eatenAt, deletedAt',
  mealItems: 'id, mealId, foodId, recipeId, updatedAt, deletedAt',
  dailyNutritionTargets: 'id, userId, localDate, &[userId+localDate], createdAt',
  nutritionSettings: 'id, &userId, updatedAt',
}
