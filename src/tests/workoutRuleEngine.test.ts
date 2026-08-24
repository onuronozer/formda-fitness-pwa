import { describe, expect, it } from 'vitest'
import { createEntityMetadata, type ExerciseHealthConsideration, type UserProfile } from '../domain/models'
import type { HealthRiskResult } from '../rules/health'
import { WorkoutRuleEngine } from '../rules/workout'
import { exerciseSeed } from '../seed/exerciseSeed'
import { validProfile } from './fixtures'

const evaluation = (status: HealthRiskResult['status'], reasons: HealthRiskResult['reasons'] = []): HealthRiskResult => ({ status, reasons, triggeredRules: [], evaluatedAt: '2026-08-24T08:00:00.000Z', rulesVersion: 3, debugEntries: [], matchedRules: [], attentionLevel: status === 'RED_FLAG_BLOCKED' ? 'RED_FLAG' : status === 'MEDICAL_REVIEW_REQUIRED' ? 'MEDICAL_REVIEW' : 'ROUTINE' })
const profile = (days: number, overrides: Partial<UserProfile> = {}): UserProfile => ({ ...validProfile, trainingDaysPerWeek: days, ...overrides })
const engine = new WorkoutRuleEngine()

describe('WorkoutRuleEngine', () => {
  it('generates two beginner full-body days', () => {
    const result = engine.generate(profile(2), evaluation('NORMAL'), exerciseSeed, [])
    expect(result.days).toHaveLength(2); expect(result.days.map((day) => day.name)).toEqual(['Full Body A', 'Full Body B'])
  })
  it('generates three beginner full-body days', () => expect(engine.generate(profile(3), evaluation('NORMAL'), exerciseSeed, []).days).toHaveLength(3))
  it('generates a four-day upper/lower program', () => expect(engine.generate(profile(4), evaluation('NORMAL'), exerciseSeed, []).days.map((day) => day.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']))

  it('honors home equipment', () => {
    const result = engine.generate(profile(3, { trainingLocation: 'home', availableEquipment: ['bodyweight'] }), evaluation('NORMAL'), exerciseSeed, [])
    const selected = result.days.flatMap((day) => day.exercises.map((item) => exerciseSeed.find((exercise) => exercise.id === item.exerciseId)!))
    expect(selected.every((exercise) => exercise.equipmentIds.includes('equipment-bodyweight'))).toBe(true)
  })

  it('uses gym exercise options', () => {
    const result = engine.generate(profile(3, { trainingLocation: 'gym' }), evaluation('NORMAL'), exerciseSeed, [])
    expect(result.days.flatMap((day) => day.exercises).some((item) => exerciseSeed.find((exercise) => exercise.id === item.exerciseId)?.equipmentIds.some((id) => id === 'equipment-machine' || id === 'equipment-cable'))).toBe(true)
  })

  it('keeps normal volume for NORMAL health', () => expect(engine.generate(profile(3), evaluation('NORMAL'), exerciseSeed, []).days[0].exercises.every((item) => item.targetSets === 3 && item.targetRpe === 7)).toBe(true))
  it('reduces volume and target RPE for MODIFIED health', () => expect(engine.generate(profile(3), evaluation('MODIFIED', ['knee_problem']), exerciseSeed, []).days[0].exercises.every((item) => item.targetSets === 2 && item.targetRpe === 6 && item.modified)).toBe(true))
  it('does not generate for MEDICAL_REVIEW_REQUIRED', () => expect(engine.generate(profile(3), evaluation('MEDICAL_REVIEW_REQUIRED'), exerciseSeed, [])).toMatchObject({ allowed: false, reason: 'medical_review' }))
  it('does not generate for RED_FLAG_BLOCKED', () => expect(engine.generate(profile(3), evaluation('RED_FLAG_BLOCKED'), exerciseSeed, [])).toMatchObject({ allowed: false, reason: 'red_flag' }))

  it('uses a reviewed substitution', () => {
    const consideration: ExerciseHealthConsideration = {
      id: crypto.randomUUID(), createdAt: '2026-08-24T08:00:00.000Z', updatedAt: '2026-08-24T08:00:00.000Z', version: 1, schemaVersion: 4,
      exerciseId: 'exercise-bodyweight-squat', conditionType: 'knee_problem', status: 'MODIFY', symptomTriggers: [], modificationType: 'variation',
      alternativeExerciseIds: ['exercise-chair-squat'], evidenceIds: ['test-evidence'], reviewed: true, reviewStatus: 'REVIEWED', reviewedBy: 'test-reviewer', reviewedAt: '2026-08-24T00:00:00.000Z', nextReviewAt: '2027-02-24T00:00:00.000Z',
    }
    const evidence = [{ ...createEntityMetadata(), id: 'test-evidence', title: 'Test evidence', organization: 'Test', year: 2026, evidenceType: 'guideline' as const, lastReviewedAt: '2026-08-24T00:00:00.000Z', verificationStatus: 'VERIFIED' as const, reviewStatus: 'PENDING' as const }]
    const result = engine.generate(profile(2), evaluation('MODIFIED', ['knee_problem']), exerciseSeed, [consideration], evidence)
    expect(result.days[0].exercises.map((item) => item.exerciseId)).toContain('exercise-chair-squat')
  })

  it('returns a no-eligible-exercise edge result', () => expect(engine.generate(profile(2), evaluation('NORMAL'), [], [])).toMatchObject({ allowed: false, reason: 'no_eligible_exercise' }))
})
