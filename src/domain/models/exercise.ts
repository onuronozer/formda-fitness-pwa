import type { ExerciseDifficulty, ExerciseHealthStatus, ExerciseMediaOpenMode, ExerciseMediaStatus, ExerciseMediaType, HealthConditionType, MovementPattern, ReviewStatus } from '../enums'
import type { EntityMetadata } from './common'

export interface Muscle extends EntityMetadata {
  name: string
  slug: string
  active: boolean
  seedVersion: number
}

export interface Equipment extends EntityMetadata {
  name: string
  slug: string
  active: boolean
  seedVersion: number
}

export interface Exercise extends EntityMetadata {
  name: string
  slug: string
  movementPattern: MovementPattern
  difficulty: ExerciseDifficulty
  equipmentIds: string[]
  primaryMuscleIds: string[]
  secondaryMuscleIds: string[]
  instructions: string[]
  commonMistakes: string[]
  progressionExerciseIds: string[]
  regressionExerciseIds: string[]
  substitutionExerciseIds: string[]
  unilateral: boolean
  active: boolean
  seedVersion: number
}

export interface ExerciseHealthConsideration extends EntityMetadata {
  exerciseId: string
  conditionType: HealthConditionType
  status: ExerciseHealthStatus
  symptomTriggers: string[]
  modificationType?: 'variation' | 'volume' | 'intensity' | 'range_of_motion'
  alternativeExerciseIds: string[]
  evidenceIds: string[]
  reviewed: boolean
  reviewedBy?: string
  reviewedAt?: string
  nextReviewAt?: string
  reviewStatus: ReviewStatus
}

export interface ExerciseMedia extends EntityMetadata {
  exerciseId: string
  provider: string
  mediaType: ExerciseMediaType
  url?: string
  externalId?: string
  durationSeconds?: number
  status: ExerciseMediaStatus
  openMode: ExerciseMediaOpenMode
  lastVerifiedAt?: string
  sourceName: string
  sourceUrl?: string
  notes?: string
}
