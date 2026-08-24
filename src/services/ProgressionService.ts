import { PAIN_LEVELS } from '../domain/enums'
import type { WorkoutExercise, WorkoutSet } from '../domain/models'
import { PROGRESSION_MAX_AVERAGE_RPE } from '../config/workouts'

export interface ProgressionResult { eligible: boolean; reason: 'eligible' | 'insufficient_history' | 'rep_target' | 'high_rpe' | 'pain' }

export function evaluateProgression(target: WorkoutExercise, sets: WorkoutSet[]): ProgressionResult {
  const completed = sets.filter((set) => set.completed && set.exerciseId === target.exerciseId)
  if (completed.length < target.targetSets) return { eligible: false, reason: 'insufficient_history' }
  if (!completed.every((set) => (set.reps ?? 0) >= target.targetRepMax)) return { eligible: false, reason: 'rep_target' }
  const painRank = (value: WorkoutSet['painDuringSet']) => value ? PAIN_LEVELS.indexOf(value) : 0
  if (completed.some((set) => painRank(set.painDuringSet) > PAIN_LEVELS.indexOf('mild'))) return { eligible: false, reason: 'pain' }
  const rpeValues = completed.flatMap((set) => set.rpe === undefined ? [] : [set.rpe])
  if (rpeValues.length && rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length > PROGRESSION_MAX_AVERAGE_RPE) return { eligible: false, reason: 'high_rpe' }
  return { eligible: true, reason: 'eligible' }
}
