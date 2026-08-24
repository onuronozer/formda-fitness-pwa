import { PROGRAM_CONFIG, availableEquipmentForProfile, isSupportedTrainingDays } from '../../config/program'
import type { MovementPattern } from '../../domain/enums'
import type { EvidenceReference, Exercise, ExerciseHealthConsideration, UserProfile } from '../../domain/models'
import { clinicalEvidenceSeed } from '../../seed/evidenceSeed'
import type { HealthRiskResult } from '../health'
import { isOperationalHealthConsideration } from './healthConsiderationPolicy'

export interface GeneratedDay {
  name: string
  scheduledWeekday: number
  requiredMovementPatterns: MovementPattern[]
  exercises: Array<{ exerciseId: string; targetSets: number; targetRepMin: number; targetRepMax: number; targetRpe: number; restSeconds: number; modified: boolean }>
}

export interface WorkoutGenerationResult {
  allowed: boolean
  status: HealthRiskResult['status']
  reason?: 'medical_review' | 'red_flag' | 'no_eligible_exercise' | 'unsupported_training_days'
  days: GeneratedDay[]
}

export class WorkoutRuleEngine {
  generate(profile: UserProfile, evaluation: HealthRiskResult, exercises: Exercise[], considerations: ExerciseHealthConsideration[], evidenceReferences: EvidenceReference[] = clinicalEvidenceSeed): WorkoutGenerationResult {
    if (evaluation.status === 'RED_FLAG_BLOCKED') return { allowed: false, status: evaluation.status, reason: 'red_flag', days: [] }
    if (evaluation.status === 'MEDICAL_REVIEW_REQUIRED') return { allowed: false, status: evaluation.status, reason: 'medical_review', days: [] }
    if (!isSupportedTrainingDays(profile.trainingDaysPerWeek)) return { allowed: false, status: evaluation.status, reason: 'unsupported_training_days', days: [] }

    const equipment = availableEquipmentForProfile(profile)
    const relevant = considerations.filter((item) => isOperationalHealthConsideration(item, evidenceReferences) && evaluation.reasons.includes(item.conditionType))
    const excluded = new Set(relevant.filter((item) => item.status === 'PROFESSIONAL_REVIEW' || item.status === 'AVOID_WHEN_SYMPTOMATIC').map((item) => item.exerciseId))
    const alternatives = new Map(relevant.filter((item) => item.status === 'MODIFY').flatMap((item) => item.alternativeExerciseIds.map((alternative) => [item.exerciseId, alternative] as const)))
    const eligible = exercises.filter((exercise) => exercise.active && exercise.equipmentIds.some((id) => equipment.has(id)) && !excluded.has(exercise.id))
    if (!eligible.length) return { allowed: false, status: evaluation.status, reason: 'no_eligible_exercise', days: [] }

    const modified = evaluation.status === 'MODIFIED'
    const defaults = modified ? PROGRAM_CONFIG.modifiedDefaults : PROGRAM_CONFIG.beginnerDefaults
    const templates = PROGRAM_CONFIG.templates[profile.trainingDaysPerWeek]
    const weekdays = PROGRAM_CONFIG.scheduledWeekdays[profile.trainingDaysPerWeek]
    const days = templates.map((template, dayIndex): GeneratedDay => {
      const used = new Set<string>()
      const requiredMovementPatterns = template.patterns.filter((pattern) => eligible.some((exercise) => exercise.movementPattern === pattern))
      const selected = template.patterns.flatMap((pattern) => {
        const candidates = eligible.filter((exercise) => exercise.movementPattern === pattern && !used.has(exercise.id)).sort((left, right) => {
          const difficultyRank = { beginner: 0, intermediate: 1, advanced: 2 }
          return difficultyRank[left.difficulty] - difficultyRank[right.difficulty] || left.slug.localeCompare(right.slug)
        })
        const original = candidates[0]
        if (!original) return []
        const substituteId = alternatives.get(original.id)
        const exercise = substituteId ? eligible.find((candidate) => candidate.id === substituteId) ?? original : original
        used.add(exercise.id)
        return [{ exerciseId: exercise.id, targetSets: defaults.targetSets, targetRepMin: defaults.repMin, targetRepMax: defaults.repMax, targetRpe: defaults.targetRpe, restSeconds: defaults.restSeconds, modified }]
      })
      return { name: template.name, scheduledWeekday: weekdays[dayIndex], requiredMovementPatterns, exercises: selected }
    })
    if (days.some((day) => day.exercises.length === 0)) return { allowed: false, status: evaluation.status, reason: 'no_eligible_exercise', days: [] }
    return { allowed: true, status: evaluation.status, days }
  }
}
