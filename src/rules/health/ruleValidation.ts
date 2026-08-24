import type { EvidenceReference } from '../../domain/models'
import type { RuleMetadata } from './types'

export interface RuleValidationResult {
  valid: boolean
  errors: string[]
}

export function validateRuleSet(rules: RuleMetadata[], evidenceReferences: EvidenceReference[]): RuleValidationResult {
  const verifiedEvidenceIds = new Set(evidenceReferences.filter((reference) => reference.verificationStatus === 'VERIFIED').map((reference) => reference.id))
  const errors: string[] = []

  for (const rule of rules) {
    if (rule.status !== 'ACTIVE') continue
    if (rule.ruleType === 'EVIDENCE_RULE' && rule.evidenceIds.length === 0) errors.push(`${rule.id}:evidence_required`)
    for (const evidenceId of rule.evidenceIds ?? []) {
      if (!verifiedEvidenceIds.has(evidenceId)) errors.push(`${rule.id}:invalid_evidence:${evidenceId}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function assertValidRuleSet(rules: RuleMetadata[], evidenceReferences: EvidenceReference[]) {
  const result = validateRuleSet(rules, evidenceReferences)
  if (!result.valid) throw new Error(`Geçersiz kural seti: ${result.errors.join(', ')}`)
}
