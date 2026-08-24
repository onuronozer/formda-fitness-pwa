import type { NutritionActivityLevel } from '../domain/models'

export const NUTRITION_SEED_VERSION = 3
export const NUTRITION_CALCULATION_VERSION = 1
export const NUTRITION_TARGET_RULE_VERSION = 1

export const NUTRITION_PROGRAM_CONFIG = {
  activityMultipliers: { sedentary: 1.2, light: 1.35, moderate: 1.5, high: 1.7 } satisfies Record<NutritionActivityLevel, number>,
  weightLossDeficitFraction: 0.1,
  resistanceTrainingProteinGPerKg: 1.6,
  generalProteinGPerKg: 1.2,
  fatEnergyFraction: 0.3,
} as const

export const NUTRITION_RULE_PROVENANCE = {
  energyEquation: { id: 'nutrition-energy-mifflin-1990', type: 'EVIDENCE_RULE', evidenceIds: ['evidence-mifflin-1990'], version: 1 },
  proteinResistance: { id: 'nutrition-protein-resistance-2018', type: 'EVIDENCE_RULE', evidenceIds: ['evidence-morton-protein-2018'], version: 1 },
  activityMultiplier: { id: 'nutrition-activity-multiplier-v1', type: 'PROGRAM_RULE', evidenceIds: [], version: 1 },
  calorieDeficit: { id: 'nutrition-calorie-deficit-v1', type: 'PROGRAM_RULE', evidenceIds: [], version: 1 },
  macroDistribution: { id: 'nutrition-macro-distribution-v1', type: 'PROGRAM_RULE', evidenceIds: [], version: 1 },
  sodiumVisibility: { id: 'nutrition-hypertension-sodium-visibility-v1', type: 'PRODUCT_SAFETY_RULE', evidenceIds: [], version: 1 },
} as const
