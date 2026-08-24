import type { PainLevel, PrimaryGoal, WorkoutSessionStatus } from '../enums'
import type { EntityMetadata } from './common'

export interface WorkoutPlan extends EntityMetadata {
  userId: string
  name: string
  goal: PrimaryGoal
  daysPerWeek: number
  healthStatusAtGeneration: string
  active: boolean
  generatedByRuleVersion?: number
  validationResult?: WorkoutPlanValidationResult
  validatedAt?: string
}

export interface WorkoutPlanValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface WorkoutDay extends EntityMetadata {
  workoutPlanId: string
  dayIndex: number
  scheduledWeekday: number
  name: string
}

export interface WorkoutExercise extends EntityMetadata {
  workoutDayId: string
  exerciseId: string
  order: number
  targetSets: number
  targetRepMin: number
  targetRepMax: number
  targetRpe?: number
  restSeconds: number
  modified: boolean
}

export interface WorkoutSession extends EntityMetadata {
  userId: string
  workoutDayId: string
  startedAt: string
  completedAt?: string
  localDate: string
  healthEvaluationId: string
  preWorkoutCheckId?: string
  status: WorkoutSessionStatus
}

export interface WorkoutSet extends EntityMetadata {
  workoutSessionId: string
  exerciseId: string
  setNumber: number
  weightKg?: number
  reps?: number
  rpe?: number
  completed: boolean
  painDuringSet?: PainLevel
  painBodyArea?: string
}
