import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DailyHealthSheet } from '../components/DailyHealthSheet'
import { createEntityMetadata, type DailyHealthCheck, type DailyHealthResponse } from '../domain/models'
import { condition, USER_ID } from './fixtures'

describe('DailyHealthSheet', () => {
  it('hydrates the latest revision responses when reopened', () => {
    const check: DailyHealthCheck = {
      ...createEntityMetadata(),
      userId: USER_ID,
      localDate: '2026-08-24',
      checkedAt: '2026-08-24T08:00:00.000Z',
      revision: 3,
      overallPain: 2,
      energyLevel: 4,
      unusualSymptoms: false,
    }
    const response: DailyHealthResponse = {
      ...createEntityMetadata(),
      userId: USER_ID,
      healthCheckId: check.id,
      conditionType: 'lumbar_disc_herniation',
      questionKey: 'bladder_change',
      booleanValue: true,
    }

    render(<DailyHealthSheet open userId={USER_ID} conditions={[condition('lumbar_disc_herniation')]} previous={check} previousResponses={[response]} onClose={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'Yeni mesane değişikliği' })).toBeChecked()
    expect(screen.getByRole('slider', { name: 'Ağrı düzeyi' })).toHaveValue('2')
    expect(screen.getByRole('slider', { name: 'Enerji düzeyi' })).toHaveValue('4')
  })
})
