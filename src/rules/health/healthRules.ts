import type { HealthConditionType } from '../../domain/enums'
import { EVIDENCE_IDS } from '../../seed/evidenceSeed'
import type { HealthRule, ProductSafetyRuleMetadata } from './types'

export const HEALTH_RULES_VERSION = 3
const reviewedAt = '2026-08-24T00:00:00.000Z'
const nextReviewAt = '2027-02-24T00:00:00.000Z'

const product = (id: string, rationale: string, priority: number): ProductSafetyRuleMetadata => ({
  id, ruleType: 'PRODUCT_SAFETY_RULE', rationale, owner: 'Formda product safety', version: 1, priority,
  status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING',
})

const profileProduct = (id: string, conditionType: HealthConditionType, status: HealthRule['action']['status'], priority: number, rationale: string, predicates: HealthRule['predicates'] = [], match: HealthRule['match'] = 'all'): HealthRule => ({
  ...product(id, rationale, priority), scope: 'profile', conditionType, match, predicates,
  action: { status, reason: conditionType, attentionLevel: status === 'MEDICAL_REVIEW_REQUIRED' ? 'MEDICAL_REVIEW' : 'ROUTINE' },
})

const runtimeProduct = (id: string, scope: 'daily' | 'pre_workout', status: HealthRule['action']['status'], priority: number, rationale: string, conditionType?: HealthConditionType): HealthRule => ({
  ...product(id, rationale, priority), scope, conditionType, match: 'all', predicates: [],
  action: { status, reason: conditionType, attentionLevel: status === 'MEDICAL_REVIEW_REQUIRED' ? 'MEDICAL_REVIEW' : 'ROUTINE' },
})

export const healthRules: HealthRule[] = [
  profileProduct('HTN_001', 'hypertension', 'MODIFIED', 100, 'Conservative product safety policy for an active hypertension profile.'),
  profileProduct('HTN_002', 'hypertension', 'MEDICAL_REVIEW_REQUIRED', 600, 'Conservative product safety policy for reported exercise-associated symptoms.', [
    { operator: 'any_true', questionKeys: ['exercise_dizziness', 'exercise_chest_pain'] },
  ], 'any'),
  profileProduct('LUMBAR_001', 'lumbar_disc_herniation', 'MODIFIED', 100, 'Conservative product safety policy for an active lumbar disc herniation profile.'),
  profileProduct('LUMBAR_002', 'lumbar_disc_herniation', 'MEDICAL_REVIEW_REQUIRED', 500, 'Conservative product safety policy for neurologic change or an existing professional restriction.', [
    { operator: 'any_true', questionKeys: ['radiating_leg_pain', 'numbness', 'weakness', 'acute_flare', 'professional_restriction'] },
  ], 'any'),
  {
    id: 'LUMBAR_RED_001', ruleType: 'EVIDENCE_RULE', rationale: 'Cauda equina warning features require urgent clinical assessment; the app blocks exercise without assigning a diagnosis.',
    version: 1, priority: 1000, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.caudaEquinaGuidelines2025, EVIDENCE_IDS.wfnsLumbarConservative2024],
    scope: 'profile', conditionType: 'lumbar_disc_herniation', match: 'any', predicates: [{ operator: 'any_true', questionKeys: ['new_bladder_dysfunction', 'new_bowel_dysfunction', 'saddle_numbness', 'progressive_motor_weakness'] }],
    action: { status: 'RED_FLAG_BLOCKED', reason: 'lumbar_disc_herniation', attentionLevel: 'RED_FLAG' },
  },
  ...(['diabetes', 'knee_problem', 'shoulder_problem', 'other'] as const).map((conditionType, index) => profileProduct(`GENERAL_MOD_${index + 1}`, conditionType, 'MODIFIED', 80, 'Conservative product safety policy for a reported health condition.')),
  profileProduct('CARDIO_001', 'cardiovascular_condition', 'MEDICAL_REVIEW_REQUIRED', 550, 'Conservative product safety policy: cardiovascular conditions require individual review before generated training.'),
  runtimeProduct('DAILY_UNUSUAL_SYMPTOMS', 'daily', 'MEDICAL_REVIEW_REQUIRED', 700, 'Conservative product safety policy for new or unusual symptoms.'),
  runtimeProduct('DAILY_HIGH_PAIN', 'daily', 'MEDICAL_REVIEW_REQUIRED', 650, 'Conservative product safety pain threshold; not represented as a medical guideline threshold.'),
  runtimeProduct('DAILY_MODERATE_PAIN', 'daily', 'MODIFIED', 180, 'Conservative product safety pain threshold; not represented as a medical guideline threshold.'),
  runtimeProduct('DAILY_LOW_ENERGY', 'daily', 'MODIFIED', 170, 'Conservative product safety policy for low self-reported energy.'),
  {
    id: 'DAILY_LUMBAR_RED_FLAG', ruleType: 'EVIDENCE_RULE', rationale: 'New bladder, bowel, saddle sensory, or progressive motor changes are exercise-blocking warning features, without assigning a diagnosis.',
    version: 1, priority: 1200, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.caudaEquinaGuidelines2025],
    scope: 'daily', conditionType: 'lumbar_disc_herniation', match: 'all', predicates: [], action: { status: 'RED_FLAG_BLOCKED', reason: 'lumbar_disc_herniation', attentionLevel: 'RED_FLAG' },
  },
  runtimeProduct('DAILY_LUMBAR_NEURO_CHANGE', 'daily', 'MEDICAL_REVIEW_REQUIRED', 720, 'Conservative product safety policy for a new neurologic change.', 'lumbar_disc_herniation'),
  {
    id: 'DAILY_HTN_REPEAT_REQUIRED', ruleType: 'EVIDENCE_RULE', rationale: 'An initial blood pressure at the configured severe threshold blocks exercise and requires a repeat measurement after at least one minute.',
    version: 1, priority: 950, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.accAhaBloodPressure2025, EVIDENCE_IDS.ahaSevereBpRepeat],
    scope: 'daily', conditionType: 'hypertension', match: 'all', predicates: [], action: { status: 'MEDICAL_REVIEW_REQUIRED', reason: 'hypertension', attentionLevel: 'REPEAT_MEASUREMENT' },
  },
  {
    id: 'DAILY_HTN_REPEAT_REVIEW', ruleType: 'EVIDENCE_RULE', rationale: 'A repeated measurement above the configured severe threshold without acute warning symptoms blocks exercise pending medical review.',
    version: 1, priority: 980, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.accAhaBloodPressure2025, EVIDENCE_IDS.ahaSevereBpRepeat],
    scope: 'daily', conditionType: 'hypertension', match: 'all', predicates: [], action: { status: 'MEDICAL_REVIEW_REQUIRED', reason: 'hypertension', attentionLevel: 'MEDICAL_REVIEW' },
  },
  {
    id: 'DAILY_HTN_REPEAT_URGENT', ruleType: 'EVIDENCE_RULE', rationale: 'A repeated measurement above the configured severe threshold with an acute warning symptom requires urgent evaluation; the app does not assign a diagnosis.',
    version: 1, priority: 1100, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.accAhaBloodPressure2025, EVIDENCE_IDS.ahaSevereBpRepeat],
    scope: 'daily', conditionType: 'hypertension', match: 'all', predicates: [], action: { status: 'MEDICAL_REVIEW_REQUIRED', reason: 'hypertension', attentionLevel: 'URGENT' },
  },
  runtimeProduct('DAILY_HTN_ACUTE_SYMPTOM', 'daily', 'MEDICAL_REVIEW_REQUIRED', 715, 'Conservative product safety policy for a newly reported acute warning symptom.', 'hypertension'),
  runtimeProduct('DAILY_HTN_DIZZINESS', 'daily', 'MEDICAL_REVIEW_REQUIRED', 710, 'Conservative product safety policy for dizziness reported with an active hypertension profile.', 'hypertension'),
  runtimeProduct('PRE_WORKOUT_NEW_SYMPTOMS', 'pre_workout', 'MEDICAL_REVIEW_REQUIRED', 730, 'Conservative product safety policy for a condition change reported immediately before exercise.'),
  {
    id: 'PRE_WORKOUT_LUMBAR_RED_FLAG', ruleType: 'EVIDENCE_RULE', rationale: 'A newly reported cauda equina warning feature immediately before exercise blocks session creation without assigning a diagnosis.',
    version: 1, priority: 1250, status: 'ACTIVE', reviewedAt, nextReviewAt, reviewStatus: 'PENDING', evidenceIds: [EVIDENCE_IDS.caudaEquinaGuidelines2025],
    scope: 'pre_workout', conditionType: 'lumbar_disc_herniation', match: 'all', predicates: [], action: { status: 'RED_FLAG_BLOCKED', reason: 'lumbar_disc_herniation', attentionLevel: 'RED_FLAG' },
  },
]

export const healthRuleById = new Map(healthRules.map((rule) => [rule.id, rule]))
