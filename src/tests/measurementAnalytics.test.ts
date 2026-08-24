import { describe, expect, it } from 'vitest'
import type { WeightRecord } from '../domain/models'
import { buildWeightMetrics, calculateGoalProgress, calculateRollingWeightAverage, selectDailyWeights } from '../domain/measurements/analytics'
import { USER_ID } from './fixtures'

function weight(id: number, localDate: string, valueKg: number, time = '08:00', measuredAt?: string): WeightRecord {
  const timestamp = measuredAt ?? `${localDate}T${time}:00.000Z`
  return { id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, userId: USER_ID, valueKg, localDate, measuredAt: timestamp, source: 'manual', createdAt: timestamp, updatedAt: timestamp, version: 1, schemaVersion: 3 }
}

describe('weight analytics', () => {
  it('handles a single record', () => {
    const metrics = buildWeightMetrics([weight(1, '2026-08-24', 86.4)], 82, '2026-08-24')
    expect(metrics.latestWeight).toBe(86.4)
    expect(metrics.startingWeight).toBe(86.4)
    expect(metrics.changeFromStart).toBe(0)
  })

  it('keeps same-day records and selects the latest daily value', () => {
    const records = [weight(1, '2026-08-24', 86.6, '08:10'), weight(2, '2026-08-24', 87.1, '20:30')]
    expect(records).toHaveLength(2)
    expect(selectDailyWeights(records, 'latest')).toMatchObject([{ localDate: '2026-08-24', valueKg: 87.1 }])
    expect(selectDailyWeights(records, 'first')[0].valueKg).toBe(86.6)
    expect(selectDailyWeights(records, 'average')[0].valueKg).toBe(86.85)
  })

  it('uses creation order when same-day measurement times are equal', () => {
    const first = weight(1, '2026-08-24', 86.6, '08:10')
    const second = { ...weight(2, '2026-08-24', 86.2, '08:10'), createdAt: '2026-08-24T08:10:01.000Z' }
    expect(selectDailyWeights([second, first], 'latest')[0]).toMatchObject({ valueKg: 86.2, representativeRecordId: second.id })
    expect(buildWeightMetrics([second, first], 80, '2026-08-24').latestWeight).toBe(86.2)
  })

  it('uses seven calendar days, not the latest seven records', () => {
    const records = [
      weight(1, '2026-08-18', 87), weight(2, '2026-08-19', 86), weight(3, '2026-08-19', 88, '20:00'),
      weight(4, '2026-08-21', 85), weight(5, '2026-08-24', 84), weight(6, '2026-08-17', 100),
    ]
    expect(calculateRollingWeightAverage(records, '2026-08-24', 7)).toBe(86)
  })

  it('excludes missing days instead of treating them as zero', () => {
    const records = [weight(1, '2026-08-18', 80), weight(2, '2026-08-22', 82), weight(3, '2026-08-24', 84)]
    expect(calculateRollingWeightAverage(records, '2026-08-24', 7)).toBe(82)
  })

  it('compares the current and previous seven-day windows', () => {
    const records = [
      weight(1, '2026-08-11', 90), weight(2, '2026-08-15', 88),
      weight(3, '2026-08-18', 86), weight(4, '2026-08-24', 84),
    ]
    const metrics = buildWeightMetrics(records, 80, '2026-08-24')
    expect(metrics.previous7DayAverage).toBe(89)
    expect(metrics.rolling7DayAverage).toBe(85)
    expect(metrics.trendDifference).toBe(-4)
    expect(metrics.trend).toBe('down')
  })

  it('aggregates by localDate even when UTC timestamps cross calendar days', () => {
    const records = [
      weight(1, '2026-08-24', 86.6, '00:30', '2026-08-23T21:30:00.000Z'),
      weight(2, '2026-08-24', 86.2, '23:30', '2026-08-24T20:30:00.000Z'),
    ]
    expect(selectDailyWeights(records)).toHaveLength(1)
    expect(selectDailyWeights(records)[0].valueKg).toBe(86.2)
  })

  it('clamps reversed goal progress between zero and one', () => {
    expect(calculateGoalProgress(90, 92, 80)).toBe(0)
    expect(calculateGoalProgress(90, 75, 80)).toBe(1)
    expect(calculateGoalProgress(70, 68, 80)).toBe(0)
  })
})
