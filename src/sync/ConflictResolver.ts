import type { SyncEntityType } from '../domain/models'
import type { ConflictResolution } from './types'

export const EVENT_ENTITY_TYPES = new Set<SyncEntityType>(['weightRecords', 'waistRecords', 'stepRecords', 'healthEvaluationLogs', 'dailyHealthChecks', 'dailyHealthResponses', 'preWorkoutChecks', 'workoutSessions', 'workoutSets', 'waterRecords', 'dailyHydrationTargets', 'dailyGoalPlans', 'cardioSessions', 'meals', 'mealItems', 'dailyNutritionTargets'])
export const VERSIONED_ENTITY_TYPES = new Set<SyncEntityType>(['userProfiles', 'healthProfiles', 'healthConditions', 'conditionAnswers', 'workoutPlans', 'workoutDays', 'workoutExercises', 'dailyGoalSettings', 'foods', 'recipes', 'recipeIngredients', 'favoriteFoods', 'nutritionSettings'])

const version = (record: Record<string, unknown>) => typeof record.version === 'number' ? record.version : 0
const updatedAt = (record: Record<string, unknown>) => typeof record.updatedAt === 'string' ? record.updatedAt : ''
const deletedAt = (record: Record<string, unknown>) => typeof record.deletedAt === 'string' ? record.deletedAt : undefined
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}

export class ConflictResolver {
  resolve(entityType: SyncEntityType, local: Record<string, unknown> | undefined, remote: Record<string, unknown>): ConflictResolution {
    if (!local) return { winner: 'remote', record: remote, reason: 'missing_local' }
    const localDeleted = deletedAt(local)
    const remoteDeleted = deletedAt(remote)
    if (localDeleted && !remoteDeleted) return { winner: 'local', record: local, reason: 'tombstone' }
    if (remoteDeleted && !localDeleted) return { winner: 'remote', record: remote, reason: 'tombstone' }
    if (version(remote) > version(local)) return { winner: 'remote', record: remote, reason: 'higher_version' }
    if (version(local) > version(remote)) return { winner: 'local', record: local, reason: 'higher_version' }
    if (updatedAt(remote) > updatedAt(local)) return { winner: 'remote', record: remote, reason: 'newer_timestamp' }
    if (updatedAt(local) > updatedAt(remote)) return { winner: 'local', record: local, reason: 'newer_timestamp' }
    const localContent = canonical(local)
    const remoteContent = canonical(remote)
    if (localContent !== remoteContent) return remoteContent > localContent
      ? { winner: 'remote', record: remote, reason: 'content_tiebreaker' }
      : { winner: 'local', record: local, reason: 'content_tiebreaker' }
    const policyKnown = EVENT_ENTITY_TYPES.has(entityType) || VERSIONED_ENTITY_TYPES.has(entityType)
    return { winner: 'equal', record: local, reason: policyKnown ? 'equal' : 'equal' }
  }
}
