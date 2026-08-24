import { CLINICAL_SAFETY_CONFIG, isRepeatBloodPressureHigh } from '../../config/clinicalSafety'
import type { HealthConditionType, HealthGateStatus } from '../../domain/enums'
import type { ConditionAnswer, RuleDebugEntry } from '../../domain/models'
import { clinicalEvidenceSeed } from '../../seed/evidenceSeed'
import { HEALTH_RULES_VERSION, healthRules } from './healthRules'
import { assertValidRuleSet } from './ruleValidation'
import type { HealthRiskInput, HealthRiskResult, HealthRule, RulePredicate } from './types'

const statusRank = { NORMAL: 0, MODIFIED: 1, MEDICAL_REVIEW_REQUIRED: 2, RED_FLAG_BLOCKED: 3 } as const

function answerValue(answer: ConditionAnswer | undefined) {
  if (!answer) return undefined
  return answer.booleanValue ?? answer.numberValue ?? answer.stringValue
}

function predicateMatches(predicate: RulePredicate, answers: ConditionAnswer[]): boolean {
  if (predicate.operator === 'any_true') return (predicate.questionKeys ?? []).some((key) => answerValue(answers.find((answer) => answer.questionKey === key)) === true)
  const value = answerValue(answers.find((answer) => answer.questionKey === predicate.questionKey))
  if (predicate.operator === 'equals') return value === predicate.value
  if (typeof value !== 'number' || typeof predicate.value !== 'number') return false
  if (predicate.operator === 'gte') return value >= predicate.value
  if (predicate.operator === 'lte') return value <= predicate.value
  return false
}

function ruleMatches(rule: HealthRule, answers: ConditionAnswer[]) {
  if (rule.predicates.length === 0) return true
  const results = rule.predicates.map((predicate) => predicateMatches(predicate, answers))
  return rule.match === 'all' ? results.every(Boolean) : results.some(Boolean)
}

export class HealthRiskEngine {
  private readonly ruleById: Map<string, HealthRule>

  constructor(private readonly rules: HealthRule[] = healthRules) {
    assertValidRuleSet(rules, clinicalEvidenceSeed)
    this.ruleById = new Map(rules.map((rule) => [rule.id, rule]))
  }

  evaluate(input: HealthRiskInput): HealthRiskResult {
    const evaluatedAt = new Date().toISOString()
    const activeConditions = input.conditions.filter((condition) => condition.active && !condition.deletedAt)
    const matchedRules: HealthRule[] = []
    const debugEntries: RuleDebugEntry[] = []
    const addDebug = (rule: HealthRule, evaluated: boolean, matched: boolean) => debugEntries.push({
      ruleId: rule.id, ruleType: rule.ruleType, evidenceIds: [...(rule.evidenceIds ?? [])], evaluated, matched, outcome: rule.action.status,
    })

    for (const rule of this.rules.filter((candidate) => candidate.status === 'ACTIVE' && candidate.scope === 'profile')) {
      const condition = activeConditions.find((candidate) => candidate.conditionType === rule.conditionType)
      if (!condition) { addDebug(rule, false, false); continue }
      const answers = input.answers.filter((answer) => answer.conditionId === condition.id && !answer.deletedAt)
      const matched = ruleMatches(rule, answers)
      addDebug(rule, true, matched)
      if (matched) matchedRules.push(rule)
    }

    const addRuntime = (id: string) => {
      const rule = this.ruleById.get(id)
      if (!rule || rule.status !== 'ACTIVE') throw new Error(`Kayıtsız runtime sağlık kuralı: ${id}`)
      matchedRules.push(rule)
      addDebug(rule, true, true)
    }
    const daily = input.dailyCheck
    if (daily) {
      if (daily.unusualSymptoms) addRuntime('DAILY_UNUSUAL_SYMPTOMS')
      if (daily.overallPain >= CLINICAL_SAFETY_CONFIG.pain.medicalReviewAtOrAbove) addRuntime('DAILY_HIGH_PAIN')
      else if (daily.overallPain >= CLINICAL_SAFETY_CONFIG.pain.modifiedAtOrAbove) addRuntime('DAILY_MODERATE_PAIN')
      if (daily.energyLevel <= 2) addRuntime('DAILY_LOW_ENERGY')
    }

    const responseTrue = (conditionType: HealthConditionType, keys: readonly string[]) => input.dailyResponses?.some((response) => response.conditionType === conditionType && keys.includes(response.questionKey) && response.booleanValue === true) ?? false
    if (activeConditions.some((condition) => condition.conditionType === 'lumbar_disc_herniation')) {
      if (responseTrue('lumbar_disc_herniation', ['bladder_change', 'bowel_change', 'saddle_numbness', 'progressive_motor_weakness'])) addRuntime('DAILY_LUMBAR_RED_FLAG')
      else if (responseTrue('lumbar_disc_herniation', ['radiating_leg_pain', 'new_numbness', 'new_weakness'])) addRuntime('DAILY_LUMBAR_NEURO_CHANGE')
    }
    if (activeConditions.some((condition) => condition.conditionType === 'hypertension') && daily) {
      const acuteWarning = responseTrue('hypertension', CLINICAL_SAFETY_CONFIG.acuteWarningSymptoms)
      if (acuteWarning) addRuntime('DAILY_HTN_ACUTE_SYMPTOM')
      if (responseTrue('hypertension', ['dizziness'])) addRuntime('DAILY_HTN_DIZZINESS')
      if (daily.initialHighBpDetected && daily.repeatBpRequired) addRuntime('DAILY_HTN_REPEAT_REQUIRED')
      else if (isRepeatBloodPressureHigh(daily.repeatSystolic, daily.repeatDiastolic)) addRuntime(acuteWarning ? 'DAILY_HTN_REPEAT_URGENT' : 'DAILY_HTN_REPEAT_REVIEW')
    }
    if (input.preWorkoutCheck?.newSymptoms || input.preWorkoutCheck?.conditionChangedSinceDailyCheck) addRuntime('PRE_WORKOUT_NEW_SYMPTOMS')
    if (input.preWorkoutCheck && [input.preWorkoutCheck.bladderChange, input.preWorkoutCheck.bowelChange, input.preWorkoutCheck.saddleNumbness, input.preWorkoutCheck.progressiveMotorWeakness].some(Boolean)) addRuntime('PRE_WORKOUT_LUMBAR_RED_FLAG')

    matchedRules.sort((left, right) => statusRank[right.action.status] - statusRank[left.action.status] || right.priority - left.priority)
    const winningRule = matchedRules[0]
    const status: HealthGateStatus = winningRule?.action.status ?? 'NORMAL'
    return {
      status,
      triggeredRules: matchedRules.map((rule) => rule.id),
      reasons: [...new Set(matchedRules.map((rule) => rule.action.reason).filter((reason): reason is HealthConditionType => Boolean(reason)))],
      evaluatedAt,
      rulesVersion: HEALTH_RULES_VERSION,
      debugEntries,
      matchedRules: matchedRules.map((rule) => ({ ruleId: rule.id, ruleType: rule.ruleType, evidenceIds: [...(rule.evidenceIds ?? [])], resultingStatus: rule.action.status, evaluatedAt })),
      attentionLevel: winningRule?.action.attentionLevel ?? 'ROUTINE',
    }
  }
}
