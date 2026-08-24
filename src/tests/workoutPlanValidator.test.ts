import { describe, expect, it } from 'vitest'
import { createEntityMetadata, type Exercise, type ExerciseHealthConsideration, type UserProfile } from '../domain/models'
import type { HealthRiskResult } from '../rules/health'
import { WorkoutPlanValidator, WorkoutRuleEngine } from '../rules/workout'
import { exerciseSeed } from '../seed/exerciseSeed'
import { validProfile } from './fixtures'

const engine = new WorkoutRuleEngine()
const validator = new WorkoutPlanValidator()
const profile = (days: number, changes: Partial<UserProfile> = {}): UserProfile => ({ ...validProfile, trainingDaysPerWeek: days, ...changes })
const evaluation = (status: HealthRiskResult['status'] = 'NORMAL', reasons: HealthRiskResult['reasons'] = []): HealthRiskResult => ({
  status, reasons, triggeredRules: [], evaluatedAt: '2026-08-24T08:00:00.000Z', rulesVersion: 3, debugEntries: [], matchedRules: [],
  attentionLevel: status === 'RED_FLAG_BLOCKED' ? 'RED_FLAG' : status === 'MEDICAL_REVIEW_REQUIRED' ? 'MEDICAL_REVIEW' : 'ROUTINE',
})

function build(days = 3, status: HealthRiskResult['status'] = 'NORMAL', exercises: Exercise[] = exerciseSeed, considerations: ExerciseHealthConsideration[] = []) {
  const user = profile(days)
  const healthEvaluation = evaluation(status)
  const candidate = engine.generate(user, healthEvaluation, exercises, considerations)
  return { user, healthEvaluation, candidate, exercises, considerations }
}

describe('WorkoutPlanValidator', () => {
  it.each([2, 3, 4])('accepts a valid %i-day plan', (days) => {
    expect(validator.validate(build(days))).toMatchObject({ valid: true, errors: [] })
  })

  it('rejects unsupported 5-day generation explicitly', () => {
    const input = build(5)
    expect(input.candidate.reason).toBe('unsupported_training_days')
    expect(validator.validate(input).errors).toContain('UNSUPPORTED_TRAINING_DAYS')
  })

  it('rejects an invalid exercise id', () => {
    const input = build(2); input.candidate.days[0].exercises[0].exerciseId = 'exercise-missing'
    expect(validator.validate(input).errors).toContain('INVALID_EXERCISE_ID')
  })

  it('rejects an inactive exercise', () => {
    const input = build(2); const id = input.candidate.days[0].exercises[0].exerciseId
    input.exercises = input.exercises.map((exercise) => exercise.id === id ? { ...exercise, active: false } : exercise)
    expect(validator.validate(input).errors).toContain('INACTIVE_EXERCISE')
  })

  it('rejects an equipment mismatch', () => {
    const input = build(2); const id = input.candidate.days[0].exercises[0].exerciseId
    input.exercises = input.exercises.map((exercise) => exercise.id === id ? { ...exercise, equipmentIds: ['equipment-machine'] } : exercise)
    expect(validator.validate(input).errors).toContain('EQUIPMENT_MISMATCH')
  })

  it('rejects an empty workout day', () => {
    const input = build(2); input.candidate.days[0].exercises = []
    expect(validator.validate(input).errors).toContain('EMPTY_WORKOUT_DAY')
  })

  it('rejects an invalid set count', () => {
    const input = build(2); input.candidate.days[0].exercises[0].targetSets = 0
    expect(validator.validate(input).errors).toContain('INVALID_SET_COUNT')
  })

  it('rejects an inverted rep range', () => {
    const input = build(2); input.candidate.days[0].exercises[0].targetRepMin = 13; input.candidate.days[0].exercises[0].targetRepMax = 8
    expect(validator.validate(input).errors).toContain('INVALID_REP_RANGE')
  })

  it('rejects a red-flag health gate', () => {
    expect(validator.validate(build(2, 'RED_FLAG_BLOCKED')).errors).toContain('HEALTH_RED_FLAG_BLOCKED')
  })

  it('rejects a medical-review health gate', () => {
    expect(validator.validate(build(2, 'MEDICAL_REVIEW_REQUIRED')).errors).toContain('HEALTH_MEDICAL_REVIEW_REQUIRED')
  })

  it('rejects an invalid substitution reference', () => {
    const input = build(2); const id = input.candidate.days[0].exercises[0].exerciseId
    input.exercises = input.exercises.map((exercise) => exercise.id === id ? { ...exercise, substitutionExerciseIds: ['exercise-missing'] } : exercise)
    expect(validator.validate(input).errors).toContain('INVALID_SUBSTITUTION')
  })

  it('rejects a duplicate exercise within one day', () => {
    const input = build(2); input.candidate.days[0].exercises.push({ ...input.candidate.days[0].exercises[0] })
    expect(validator.validate(input).errors).toContain('DUPLICATE_EXERCISE')
  })

  it('rejects a missing required movement pattern', () => {
    const input = build(2); input.candidate.days[0].exercises.shift()
    expect(validator.validate(input).errors).toContain('MOVEMENT_PATTERN_REQUIREMENT_MISSING')
  })

  it('rejects invalid RPE and rest values', () => {
    const input = build(2); input.candidate.days[0].exercises[0].targetRpe = 11; input.candidate.days[0].exercises[0].restSeconds = 0
    expect(validator.validate(input).errors).toEqual(expect.arrayContaining(['INVALID_RPE', 'INVALID_REST_SECONDS']))
  })

  it('rejects a reviewed health consideration without review provenance', () => {
    const consideration: ExerciseHealthConsideration = {
      ...createEntityMetadata(), exerciseId: 'exercise-bodyweight-squat', conditionType: 'knee_problem', status: 'MODIFY', symptomTriggers: [],
      alternativeExerciseIds: ['exercise-chair-squat'], evidenceIds: [], reviewed: true, reviewStatus: 'REVIEWED',
    }
    const user = profile(2); const healthEvaluation = evaluation('MODIFIED', ['knee_problem'])
    const candidate = engine.generate(user, healthEvaluation, exerciseSeed, [consideration])
    expect(validator.validate({ user, healthEvaluation, candidate, exercises: exerciseSeed, considerations: [consideration] }).errors).toContain('INVALID_REVIEWED_HEALTH_CONSIDERATION')
  })

  it('ignores pending considerations and records a warning without changing the plan', () => {
    const consideration: ExerciseHealthConsideration = {
      ...createEntityMetadata(), exerciseId: 'exercise-bodyweight-squat', conditionType: 'knee_problem', status: 'AVOID_WHEN_SYMPTOMATIC', symptomTriggers: [],
      alternativeExerciseIds: [], evidenceIds: [], reviewed: false, reviewStatus: 'PENDING',
    }
    const user = profile(2); const healthEvaluation = evaluation('MODIFIED', ['knee_problem'])
    const candidate = engine.generate(user, healthEvaluation, exerciseSeed, [consideration])
    const result = validator.validate({ user, healthEvaluation, candidate, exercises: exerciseSeed, considerations: [consideration] })
    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('UNREVIEWED_HEALTH_CONSIDERATIONS_IGNORED')
    expect(candidate.days.flatMap((day) => day.exercises).map((target) => target.exerciseId)).toContain('exercise-bodyweight-squat')
  })

  it('rejects a missing user', () => {
    const input = build(2)
    expect(validator.validate({ ...input, user: undefined }).errors).toContain('USER_NOT_FOUND')
  })
})
