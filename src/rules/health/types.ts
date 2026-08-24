import type { HealthConditionType, HealthGateStatus, ReviewStatus, RuleStatus, RuleType } from '../../domain/enums'
import type { ConditionAnswer, DailyHealthCheck, DailyHealthResponse, HealthAttentionLevel, HealthCondition, PreWorkoutCheck, RuleDebugEntry } from '../../domain/models'

export type RuleOperator = 'equals' | 'gte' | 'lte' | 'any_true'

export interface RulePredicate {
  questionKey?: string
  operator: RuleOperator
  value?: boolean | number | string
  questionKeys?: string[]
}

interface RuleMetadataBase {
  id: string
  ruleType: RuleType
  rationale: string
  version: number
  priority: number
  status: RuleStatus
  reviewedBy?: string
  reviewedAt: string
  nextReviewAt: string
  reviewStatus: ReviewStatus
}

export interface EvidenceRuleMetadata extends RuleMetadataBase {
  ruleType: 'EVIDENCE_RULE'
  evidenceIds: [string, ...string[]]
}

export interface ProductSafetyRuleMetadata extends RuleMetadataBase {
  ruleType: 'PRODUCT_SAFETY_RULE'
  owner: string
  evidenceIds?: string[]
}

export interface ProgramRuleMetadata extends RuleMetadataBase {
  ruleType: 'PROGRAM_RULE'
  owner: string
  evidenceIds?: string[]
}

export type RuleMetadata = EvidenceRuleMetadata | ProductSafetyRuleMetadata | ProgramRuleMetadata

export type HealthRule = (EvidenceRuleMetadata | ProductSafetyRuleMetadata) & {
  scope: 'profile' | 'daily' | 'pre_workout'
  conditionType?: HealthConditionType
  match: 'all' | 'any'
  predicates: RulePredicate[]
  action: { status: HealthGateStatus; reason?: HealthConditionType; attentionLevel: HealthAttentionLevel }
}

export interface HealthRiskInput {
  conditions: HealthCondition[]
  answers: ConditionAnswer[]
  dailyCheck?: DailyHealthCheck
  dailyResponses?: DailyHealthResponse[]
  preWorkoutCheck?: PreWorkoutCheck
}

export interface HealthRiskResult {
  status: HealthGateStatus
  triggeredRules: string[]
  reasons: HealthConditionType[]
  evaluatedAt: string
  rulesVersion: number
  debugEntries: RuleDebugEntry[]
  matchedRules: Array<{
    ruleId: string
    ruleType: RuleType
    evidenceIds: string[]
    resultingStatus: HealthGateStatus
    evaluatedAt: string
  }>
  attentionLevel: HealthAttentionLevel
}
