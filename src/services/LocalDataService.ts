import { appDb, type FormdaDatabase } from '../db/database'

export class LocalDataService {
  constructor(private readonly db: FormdaDatabase = appDb) {}

  async wipeUser(userId: string) {
    const planIds = await this.db.workoutPlans.where('userId').equals(userId).primaryKeys()
    const dayIds = planIds.length ? await this.db.workoutDays.where('workoutPlanId').anyOf(planIds).primaryKeys() : []
    const sessionIds = await this.db.workoutSessions.where('userId').equals(userId).primaryKeys()
    const recipeIds = await this.db.recipes.where('userId').equals(userId).primaryKeys()
    const mealIds = await this.db.meals.where('userId').equals(userId).primaryKeys()
    const tables = [
      this.db.userProfiles, this.db.healthProfiles, this.db.healthConditions, this.db.conditionAnswers,
      this.db.weightRecords, this.db.waistRecords, this.db.stepRecords, this.db.healthEvaluationLogs,
      this.db.dailyHealthChecks, this.db.dailyHealthResponses, this.db.preWorkoutChecks,
      this.db.workoutPlans, this.db.workoutDays, this.db.workoutExercises, this.db.workoutSessions, this.db.workoutSets,
      this.db.waterRecords, this.db.dailyHydrationTargets, this.db.dailyGoalSettings, this.db.dailyGoalPlans,
      this.db.cardioSessions, this.db.shortcutActionReceipts, this.db.syncOutbox,
      this.db.cloudSyncPreferences, this.db.syncConflictAudits,
      this.db.foods, this.db.recipes, this.db.recipeIngredients, this.db.favoriteFoods, this.db.meals, this.db.mealItems,
      this.db.dailyNutritionTargets, this.db.nutritionSettings,
    ]
    await this.db.transaction('rw', tables, async () => {
      await Promise.all([
        this.db.userProfiles.delete(userId),
        this.db.healthProfiles.where('userId').equals(userId).delete(),
        this.db.healthConditions.where('userId').equals(userId).delete(),
        this.db.conditionAnswers.where('userId').equals(userId).delete(),
        this.db.weightRecords.where('userId').equals(userId).delete(),
        this.db.waistRecords.where('userId').equals(userId).delete(),
        this.db.stepRecords.where('userId').equals(userId).delete(),
        this.db.healthEvaluationLogs.where('userId').equals(userId).delete(),
        this.db.dailyHealthChecks.where('userId').equals(userId).delete(),
        this.db.dailyHealthResponses.where('userId').equals(userId).delete(),
        this.db.preWorkoutChecks.where('userId').equals(userId).delete(),
        this.db.workoutPlans.where('userId').equals(userId).delete(),
        this.db.workoutSessions.where('userId').equals(userId).delete(),
        this.db.waterRecords.where('userId').equals(userId).delete(),
        this.db.dailyHydrationTargets.where('userId').equals(userId).delete(),
        this.db.dailyGoalSettings.where('userId').equals(userId).delete(),
        this.db.dailyGoalPlans.where('userId').equals(userId).delete(),
        this.db.cardioSessions.where('userId').equals(userId).delete(),
        this.db.shortcutActionReceipts.where('userId').equals(userId).delete(),
        this.db.syncOutbox.where('userId').equals(userId).delete(),
        this.db.cloudSyncPreferences.where('userId').equals(userId).delete(),
        this.db.syncConflictAudits.where('localUserId').equals(userId).delete(),
        this.db.foods.where('userId').equals(userId).delete(),
        this.db.recipes.where('userId').equals(userId).delete(),
        this.db.favoriteFoods.where('userId').equals(userId).delete(),
        this.db.meals.where('userId').equals(userId).delete(),
        this.db.dailyNutritionTargets.where('userId').equals(userId).delete(),
        this.db.nutritionSettings.where('userId').equals(userId).delete(),
      ])
      if (dayIds.length) await this.db.workoutExercises.where('workoutDayId').anyOf(dayIds).delete()
      if (planIds.length) await this.db.workoutDays.where('workoutPlanId').anyOf(planIds).delete()
      if (sessionIds.length) await this.db.workoutSets.where('workoutSessionId').anyOf(sessionIds).delete()
      if (recipeIds.length) await this.db.recipeIngredients.where('recipeId').anyOf(recipeIds).delete()
      if (mealIds.length) await this.db.mealItems.where('mealId').anyOf(mealIds).delete()
    })
  }

  async detachCloud(userId: string) {
    await this.db.transaction('rw', [this.db.syncOutbox, this.db.cloudSyncPreferences], async () => {
      await this.db.syncOutbox.where('userId').equals(userId).delete()
      await this.db.cloudSyncPreferences.where('userId').equals(userId).delete()
    })
  }
}
