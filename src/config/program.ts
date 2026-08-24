import type { MovementPattern } from '../domain/enums'
import type { UserProfile } from '../domain/models'
import type { ProgramRuleMetadata } from '../rules/health'

export const PROGRAM_RULES_VERSION = 2
export const SUPPORTED_TRAINING_DAYS = [2, 3, 4] as const
export type SupportedTrainingDays = (typeof SUPPORTED_TRAINING_DAYS)[number]

export const PROGRAM_CONFIG = {
  version: PROGRAM_RULES_VERSION,
  beginnerDefaults: { targetSets: 3, repMin: 8, repMax: 12, targetRpe: 7, restSeconds: 90 },
  modifiedDefaults: { targetSets: 2, repMin: 8, repMax: 12, targetRpe: 6, restSeconds: 90 },
  validation: { targetSets: { min: 1, max: 10 }, reps: { min: 1, max: 100 }, rpe: { min: 1, max: 10 }, restSeconds: { min: 15, max: 600 } },
  scheduledWeekdays: { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5] } as Record<SupportedTrainingDays, number[]>,
  templates: {
    2: [
      { name: 'Full Body A', patterns: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_pull', 'core_anti_extension'] },
      { name: 'Full Body B', patterns: ['lunge', 'hip_extension', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'core_anti_rotation'] },
    ],
    3: [
      { name: 'Full Body A', patterns: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_pull', 'core_anti_extension'] },
      { name: 'Full Body B', patterns: ['lunge', 'hip_extension', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'core_anti_rotation'] },
      { name: 'Full Body A', patterns: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_pull', 'core_anti_extension'] },
    ],
    4: [
      { name: 'Upper A', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'elbow_flexion', 'elbow_extension'] },
      { name: 'Lower A', patterns: ['squat', 'lunge', 'hinge', 'hip_extension', 'calf_raise', 'core_anti_extension'] },
      { name: 'Upper B', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'elbow_flexion', 'elbow_extension'] },
      { name: 'Lower B', patterns: ['squat', 'lunge', 'hinge', 'hip_extension', 'calf_raise', 'core_anti_extension'] },
    ],
  } as Record<SupportedTrainingDays, Array<{ name: string; patterns: MovementPattern[] }>>,
} as const

const review = { version: 1, priority: 100, status: 'ACTIVE', reviewedAt: '2026-08-24T00:00:00.000Z', nextReviewAt: '2027-02-24T00:00:00.000Z', reviewStatus: 'PENDING', ruleType: 'PROGRAM_RULE', owner: 'Formda workout programming' } as const
export const programRules: ProgramRuleMetadata[] = [
  { ...review, id: 'PROGRAM_BEGINNER_DEFAULTS', rationale: 'V1 programming defaults: 3 sets, 8-12 reps, target RPE 7, and 90 seconds rest. These values are product programming choices, not medical claims.' },
  { ...review, id: 'PROGRAM_MODIFIED_DEFAULTS', rationale: 'V1 conservative programming defaults: 2 sets, 8-12 reps, target RPE 6, and 90 seconds rest. These values are product programming choices.' },
  { ...review, id: 'PROGRAM_SUPPORTED_SPLITS', rationale: 'V1 supports explicit 2-, 3-, and 4-day templates only.' },
]

export function isSupportedTrainingDays(value: number): value is SupportedTrainingDays {
  return SUPPORTED_TRAINING_DAYS.includes(value as SupportedTrainingDays)
}

export function availableEquipmentForProfile(profile: UserProfile) {
  if (profile.trainingLocation === 'gym' || profile.trainingLocation === 'both') return new Set(['equipment-bodyweight', 'equipment-dumbbell', 'equipment-barbell', 'equipment-kettlebell', 'equipment-cable', 'equipment-machine', 'equipment-resistance_band', 'equipment-bench', 'equipment-pullup_bar'])
  const map: Record<string, string[]> = { bodyweight: ['equipment-bodyweight'], dumbbells: ['equipment-dumbbell', 'equipment-bench'], resistance_bands: ['equipment-resistance_band'], machines: ['equipment-machine'] }
  return new Set(profile.availableEquipment.flatMap((item) => map[item] ?? []))
}
