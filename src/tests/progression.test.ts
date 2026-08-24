import { describe, expect, it } from 'vitest'
import { createEntityMetadata, type WorkoutExercise, type WorkoutSet } from '../domain/models'
import { evaluateProgression } from '../services/ProgressionService'

const target: WorkoutExercise = { ...createEntityMetadata(), workoutDayId: crypto.randomUUID(), exerciseId: 'exercise-push-up', order: 0, targetSets: 3, targetRepMin: 8, targetRepMax: 12, targetRpe: 7, restSeconds: 90, modified: false }
const set = (setNumber: number, changes: Partial<WorkoutSet> = {}): WorkoutSet => ({ ...createEntityMetadata(), workoutSessionId: crypto.randomUUID(), exerciseId: target.exerciseId, setNumber, reps: 12, completed: true, painDuringSet: 'none', ...changes })

describe('progression policy', () => {
  it('marks all upper-range sets eligible', () => expect(evaluateProgression(target, [set(1), set(2), set(3)]).eligible).toBe(true))
  it('rejects partially achieved rep targets', () => expect(evaluateProgression(target, [set(1), set(2, { reps: 10 }), set(3)]).reason).toBe('rep_target'))
  it('rejects high average RPE', () => expect(evaluateProgression(target, [set(1, { rpe: 9 }), set(2, { rpe: 9 }), set(3, { rpe: 9 })]).reason).toBe('high_rpe'))
  it('rejects moderate pain', () => expect(evaluateProgression(target, [set(1), set(2, { painDuringSet: 'moderate' }), set(3)]).reason).toBe('pain'))
  it('requires enough completed history', () => expect(evaluateProgression(target, [set(1), set(2)]).reason).toBe('insufficient_history'))
})
