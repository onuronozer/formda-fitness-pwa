import { describe, expect, it } from 'vitest'
import type { HealthRule } from '../rules/health'
import { HealthRiskEngine } from '../rules/health'
import { answer, condition } from './fixtures'

describe('HealthRiskEngine', () => {
  it('returns NORMAL when no conditions are active', () => {
    expect(new HealthRiskEngine().evaluate({ conditions: [], answers: [] }).status).toBe('NORMAL')
  })

  it('returns MODIFIED for hypertension without warning answers', () => {
    const htn = condition('hypertension')
    const result = new HealthRiskEngine().evaluate({ conditions: [htn], answers: [] })
    expect(result.status).toBe('MODIFIED')
    expect(result.triggeredRules).toContain('HTN_001')
  })

  it('returns MODIFIED for lumbar condition without warning answers', () => {
    const lumbar = condition('lumbar_disc_herniation')
    expect(new HealthRiskEngine().evaluate({ conditions: [lumbar], answers: [] }).status).toBe('MODIFIED')
  })

  it('blocks when a lumbar red flag is true', () => {
    const lumbar = condition('lumbar_disc_herniation')
    const result = new HealthRiskEngine().evaluate({ conditions: [lumbar], answers: [answer(lumbar.id, 'saddle_numbness', true)] })
    expect(result.status).toBe('RED_FLAG_BLOCKED')
    expect(result.triggeredRules).toContain('LUMBAR_RED_001')
  })

  it('selects the most severe status across multiple conditions', () => {
    const htn = condition('hypertension', '33333333-3333-4333-8333-333333333333')
    const cardio = condition('cardiovascular_condition', '44444444-4444-4444-8444-444444444444')
    expect(new HealthRiskEngine().evaluate({ conditions: [htn, cardio], answers: [] }).status).toBe('MEDICAL_REVIEW_REQUIRED')
  })

  it('resolves conflicting priorities by severity before priority', () => {
    const metadata = { ruleType: 'PRODUCT_SAFETY_RULE', owner: 'test', rationale: 'Test-only product rule.', status: 'ACTIVE', reviewedAt: '2026-08-24T00:00:00.000Z', nextReviewAt: '2027-02-24T00:00:00.000Z', reviewStatus: 'PENDING', scope: 'profile', match: 'all', predicates: [] as HealthRule['predicates'] } as const
    const rules: HealthRule[] = [
      { ...metadata, id: 'HIGH_PRIORITY_LOW_RISK', version: 1, priority: 9999, conditionType: 'hypertension', action: { status: 'MODIFIED', reason: 'hypertension', attentionLevel: 'ROUTINE' } },
      { ...metadata, id: 'LOW_PRIORITY_BLOCK', version: 1, priority: 1, conditionType: 'hypertension', action: { status: 'RED_FLAG_BLOCKED', reason: 'hypertension', attentionLevel: 'RED_FLAG' } },
    ]
    expect(new HealthRiskEngine(rules).evaluate({ conditions: [condition('hypertension')], answers: [] }).status).toBe('RED_FLAG_BLOCKED')
  })
})
