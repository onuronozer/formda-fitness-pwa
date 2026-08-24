import { describe, expect, it } from 'vitest'
import { programRules } from '../config/program'
import type { EvidenceReference } from '../domain/models'
import { healthRules, type RuleMetadata, validateRuleSet } from '../rules/health'
import { clinicalEvidenceSeed } from '../seed/evidenceSeed'

const metadata = { version: 1, priority: 1, status: 'ACTIVE', reviewedAt: '2026-08-24T00:00:00.000Z', nextReviewAt: '2027-02-24T00:00:00.000Z', reviewStatus: 'PENDING' } as const

describe('rule classification and evidence validation', () => {
  it('keeps health and programming rules in explicit classes', () => {
    const counts = [...healthRules, ...programRules].reduce((result, rule) => ({ ...result, [rule.ruleType]: result[rule.ruleType] + 1 }), { EVIDENCE_RULE: 0, PRODUCT_SAFETY_RULE: 0, PROGRAM_RULE: 0 })
    expect(counts).toEqual({ EVIDENCE_RULE: 6, PRODUCT_SAFETY_RULE: 17, PROGRAM_RULE: 3 })
  })

  it('rejects an active EVIDENCE_RULE without evidence', () => {
    const rule = { ...metadata, id: 'TEST_EVIDENCE', ruleType: 'EVIDENCE_RULE', rationale: 'test', evidenceIds: [] } as unknown as RuleMetadata
    expect(validateRuleSet([rule], clinicalEvidenceSeed)).toMatchObject({ valid: false, errors: ['TEST_EVIDENCE:evidence_required'] })
  })

  it('allows a PRODUCT_SAFETY_RULE without evidence', () => {
    const rule: RuleMetadata = { ...metadata, id: 'TEST_SAFETY', ruleType: 'PRODUCT_SAFETY_RULE', rationale: 'Conservative product policy.', owner: 'test' }
    expect(validateRuleSet([rule], clinicalEvidenceSeed).valid).toBe(true)
  })

  it('allows a PROGRAM_RULE without evidence', () => {
    const rule: RuleMetadata = { ...metadata, id: 'TEST_PROGRAM', ruleType: 'PROGRAM_RULE', rationale: 'Programming preference.', owner: 'test' }
    expect(validateRuleSet([rule], clinicalEvidenceSeed).valid).toBe(true)
  })

  it('rejects an unknown evidence id', () => {
    const rule: RuleMetadata = { ...metadata, id: 'TEST_UNKNOWN', ruleType: 'EVIDENCE_RULE', rationale: 'test', evidenceIds: ['missing-evidence'] }
    expect(validateRuleSet([rule], clinicalEvidenceSeed).errors).toContain('TEST_UNKNOWN:invalid_evidence:missing-evidence')
  })

  it('contains only verified curated clinical references with source metadata', () => {
    expect(clinicalEvidenceSeed).toHaveLength(12)
    expect(clinicalEvidenceSeed.every((reference: EvidenceReference) => reference.verificationStatus === 'VERIFIED' && Boolean(reference.url) && Boolean(reference.organization || reference.authors?.length))).toBe(true)
    expect(clinicalEvidenceSeed.filter((reference) => reference.doi)).toHaveLength(9)
  })
})
