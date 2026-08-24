import type { EvidenceType, EvidenceVerificationStatus, HealthConditionType, HealthGateStatus, ReviewStatus, RuleType } from '../enums'
import type { EntityMetadata } from './common'

export interface HealthProfile extends EntityMetadata {
  userId: string
}

export interface HealthCondition extends EntityMetadata {
  userId: string
  healthProfileId: string
  conditionType: HealthConditionType
  active: boolean
  diagnosed?: boolean
  notes?: string
}

export interface ConditionAnswer extends EntityMetadata {
  userId: string
  conditionId: string
  questionKey: string
  booleanValue?: boolean
  numberValue?: number
  stringValue?: string
}

export interface HealthEvaluationLog extends EntityMetadata {
  userId: string
  evaluatedAt: string
  rulesVersion: number
  status: HealthGateStatus
  triggeredRuleIds: string[]
  reasons: HealthConditionType[]
  debugEntries: RuleDebugEntry[]
  matchedRules: MatchedRuleAudit[]
  attentionLevel: HealthAttentionLevel
  contextType?: 'profile' | 'daily' | 'pre_workout' | 'during_workout'
  dailyHealthCheckId?: string
  preWorkoutCheckId?: string
}

export interface RuleDebugEntry {
  ruleId: string
  ruleType: RuleType
  evidenceIds: string[]
  evaluated: boolean
  matched: boolean
  outcome: HealthGateStatus
}

export type HealthAttentionLevel = 'ROUTINE' | 'REPEAT_MEASUREMENT' | 'MEDICAL_REVIEW' | 'URGENT' | 'RED_FLAG'

export interface MatchedRuleAudit {
  ruleId: string
  ruleType: RuleType
  evidenceIds: string[]
  resultingStatus: HealthGateStatus
  evaluatedAt: string
}

export interface EvidenceReference extends EntityMetadata {
  title: string
  organization?: string
  authors?: string[]
  year: number
  doi?: string
  url?: string
  evidenceType: EvidenceType
  lastReviewedAt: string
  verificationStatus: EvidenceVerificationStatus
  reviewStatus: ReviewStatus
}
