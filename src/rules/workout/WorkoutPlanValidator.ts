import { PROGRAM_CONFIG, availableEquipmentForProfile, isSupportedTrainingDays } from '../../config/program'
import type { EvidenceReference, Exercise, ExerciseHealthConsideration, UserProfile, WorkoutPlanValidationResult } from '../../domain/models'
import { clinicalEvidenceSeed } from '../../seed/evidenceSeed'
import type { HealthRiskResult } from '../health'
import type { WorkoutGenerationResult } from './WorkoutRuleEngine'
import { isOperationalHealthConsideration } from './healthConsiderationPolicy'

export interface WorkoutPlanValidationInput {
  user?: UserProfile
  healthEvaluation: HealthRiskResult
  candidate: WorkoutGenerationResult
  exercises: Exercise[]
  considerations: ExerciseHealthConsideration[]
  evidenceReferences?: EvidenceReference[]
}

export class WorkoutPlanValidator {
  validate(input: WorkoutPlanValidationInput): WorkoutPlanValidationResult {
    const errors = new Set<string>()
    const warnings = new Set<string>()
    const evidenceReferences = input.evidenceReferences ?? clinicalEvidenceSeed
    const { user, healthEvaluation, candidate, exercises, considerations } = input

    if (!user) errors.add('USER_NOT_FOUND')
    if (healthEvaluation.status === 'RED_FLAG_BLOCKED') errors.add('HEALTH_RED_FLAG_BLOCKED')
    if (healthEvaluation.status === 'MEDICAL_REVIEW_REQUIRED') errors.add('HEALTH_MEDICAL_REVIEW_REQUIRED')
    if (!user) return { valid: false, errors: [...errors], warnings: [...warnings] }
    if (!isSupportedTrainingDays(user.trainingDaysPerWeek)) errors.add('UNSUPPORTED_TRAINING_DAYS')
    if (!candidate.allowed) errors.add(`GENERATOR_${(candidate.reason ?? 'NOT_ALLOWED').toUpperCase()}`)
    if (candidate.days.length !== user.trainingDaysPerWeek) errors.add('UNEXPECTED_DAY_COUNT')

    const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
    const equipment = availableEquipmentForProfile(user)
    const relevantConsiderations = considerations.filter((item) => healthEvaluation.reasons.includes(item.conditionType))
    const operational = relevantConsiderations.filter((item) => isOperationalHealthConsideration(item, evidenceReferences))
    if (considerations.some((item) => item.reviewed && !isOperationalHealthConsideration(item, evidenceReferences))) errors.add('INVALID_REVIEWED_HEALTH_CONSIDERATION')
    if (relevantConsiderations.some((item) => !item.reviewed)) warnings.add('UNREVIEWED_HEALTH_CONSIDERATIONS_IGNORED')
    const excluded = new Set(operational.filter((item) => item.status === 'PROFESSIONAL_REVIEW' || item.status === 'AVOID_WHEN_SYMPTOMATIC').map((item) => item.exerciseId))

    for (const consideration of operational) {
      for (const alternativeId of consideration.alternativeExerciseIds) {
        const alternative = exerciseById.get(alternativeId)
        if (!alternative || !alternative.active) errors.add('INVALID_SUBSTITUTION')
      }
    }

    for (const day of candidate.days) {
      if (day.exercises.length === 0) errors.add('EMPTY_WORKOUT_DAY')
      const used = new Set<string>()
      for (const target of day.exercises) {
        if (used.has(target.exerciseId)) errors.add('DUPLICATE_EXERCISE')
        used.add(target.exerciseId)
        const exercise = exerciseById.get(target.exerciseId)
        if (!exercise) { errors.add('INVALID_EXERCISE_ID'); continue }
        if (!exercise.active) errors.add('INACTIVE_EXERCISE')
        if (!exercise.equipmentIds.some((id) => equipment.has(id))) errors.add('EQUIPMENT_MISMATCH')
        if (excluded.has(exercise.id)) errors.add('HEALTH_EXCLUSION_VIOLATION')
        if (target.targetSets < PROGRAM_CONFIG.validation.targetSets.min || target.targetSets > PROGRAM_CONFIG.validation.targetSets.max || !Number.isInteger(target.targetSets)) errors.add('INVALID_SET_COUNT')
        if (target.targetRepMin < PROGRAM_CONFIG.validation.reps.min || target.targetRepMax > PROGRAM_CONFIG.validation.reps.max || target.targetRepMin > target.targetRepMax) errors.add('INVALID_REP_RANGE')
        if (target.targetRpe < PROGRAM_CONFIG.validation.rpe.min || target.targetRpe > PROGRAM_CONFIG.validation.rpe.max) errors.add('INVALID_RPE')
        if (target.restSeconds < PROGRAM_CONFIG.validation.restSeconds.min || target.restSeconds > PROGRAM_CONFIG.validation.restSeconds.max || !Number.isInteger(target.restSeconds)) errors.add('INVALID_REST_SECONDS')
        for (const substitutionId of exercise.substitutionExerciseIds) {
          const substitution = exerciseById.get(substitutionId)
          if (!substitution || !substitution.active) errors.add('INVALID_SUBSTITUTION')
        }
      }
      const selectedPatterns = new Set(day.exercises.map((target) => exerciseById.get(target.exerciseId)?.movementPattern).filter(Boolean))
      if (day.requiredMovementPatterns.some((pattern) => !selectedPatterns.has(pattern))) errors.add('MOVEMENT_PATTERN_REQUIREMENT_MISSING')
    }

    return { valid: errors.size === 0, errors: [...errors], warnings: [...warnings] }
  }
}
