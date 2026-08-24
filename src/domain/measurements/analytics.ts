import type { DailyWeightStrategy, WeightTrend } from '../enums'
import type { StepRecord, WaistRecord, WeightRecord } from '../models'
import { DEFAULT_DAILY_WEIGHT_STRATEGY, WEIGHT_TREND_STABLE_THRESHOLD_KG } from '../../config/measurements'
import { shiftLocalDate } from '../../utils/localDate'

export interface DailyWeightPoint {
  localDate: string
  valueKg: number
  representativeRecordId?: string
}

export interface WeightMetrics {
  latestWeight?: number
  startingWeight?: number
  targetWeight: number
  changeFromStart?: number
  remainingToTarget?: number
  rolling7DayAverage?: number
  previous7DayAverage?: number
  trendDifference?: number
  trend: WeightTrend
  goalProgress: number
}

type TimestampedMeasurement = Pick<WeightRecord, 'id' | 'measuredAt' | 'createdAt'>

export function compareMeasurementRecency(a: TimestampedMeasurement, b: TimestampedMeasurement): number {
  return a.measuredAt.localeCompare(b.measuredAt)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id)
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function selectDailyWeights(records: WeightRecord[], strategy: DailyWeightStrategy = DEFAULT_DAILY_WEIGHT_STRATEGY): DailyWeightPoint[] {
  const active = records.filter((record) => !record.deletedAt)
  const groups = new Map<string, WeightRecord[]>()
  for (const record of active) groups.set(record.localDate, [...(groups.get(record.localDate) ?? []), record])

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([localDate, dailyRecords]) => {
    const ordered = [...dailyRecords].sort(compareMeasurementRecency)
    if (strategy === 'average') return { localDate, valueKg: round(ordered.reduce((sum, record) => sum + record.valueKg, 0) / ordered.length) }
    const selected = strategy === 'first' ? ordered[0] : ordered.at(-1)!
    return { localDate, valueKg: selected.valueKg, representativeRecordId: selected.id }
  })
}

export function calculateRollingWeightAverage(records: WeightRecord[], endDate: string, days: number, strategy: DailyWeightStrategy = DEFAULT_DAILY_WEIGHT_STRATEGY): number | undefined {
  const startDate = shiftLocalDate(endDate, -(days - 1))
  const points = selectDailyWeights(records, strategy).filter((point) => point.localDate >= startDate && point.localDate <= endDate)
  if (!points.length) return undefined
  return round(points.reduce((sum, point) => sum + point.valueKg, 0) / points.length)
}

export function calculateGoalProgress(startingWeight: number | undefined, latestWeight: number | undefined, targetWeight: number): number {
  if (startingWeight === undefined || latestWeight === undefined) return 0
  if (startingWeight === targetWeight) return latestWeight === targetWeight ? 1 : 0
  const progress = (latestWeight - startingWeight) / (targetWeight - startingWeight)
  return Math.min(1, Math.max(0, progress))
}

export function buildWeightMetrics(records: WeightRecord[], targetWeight: number, endDate: string): WeightMetrics {
  const active = records.filter((record) => !record.deletedAt).sort(compareMeasurementRecency)
  const latestWeight = active.at(-1)?.valueKg
  const startingWeight = active[0]?.valueKg
  const rolling7DayAverage = calculateRollingWeightAverage(active, endDate, 7)
  const previousEndDate = shiftLocalDate(endDate, -7)
  const previous7DayAverage = calculateRollingWeightAverage(active, previousEndDate, 7)
  const trendDifference = rolling7DayAverage !== undefined && previous7DayAverage !== undefined ? round(rolling7DayAverage - previous7DayAverage) : undefined
  const trend: WeightTrend = trendDifference === undefined
    ? 'insufficient_data'
    : Math.abs(trendDifference) <= WEIGHT_TREND_STABLE_THRESHOLD_KG ? 'stable' : trendDifference < 0 ? 'down' : 'up'

  return {
    latestWeight,
    startingWeight,
    targetWeight,
    changeFromStart: latestWeight !== undefined && startingWeight !== undefined ? round(latestWeight - startingWeight) : undefined,
    remainingToTarget: latestWeight !== undefined ? round(Math.abs(targetWeight - latestWeight)) : undefined,
    rolling7DayAverage,
    previous7DayAverage,
    trendDifference,
    trend,
    goalProgress: calculateGoalProgress(startingWeight, latestWeight, targetWeight),
  }
}

export function buildWaistMetrics(records: WaistRecord[]) {
  const active = records.filter((record) => !record.deletedAt).sort(compareMeasurementRecency)
  const latest = active.at(-1)?.valueCm
  const starting = active[0]?.valueCm
  return { latest, starting, change: latest !== undefined && starting !== undefined ? round(latest - starting, 1) : undefined }
}

export function buildStepMetrics(records: StepRecord[], localDate: string, target: number) {
  const today = records.filter((record) => !record.deletedAt && record.localDate === localDate).sort(compareMeasurementRecency).at(-1)
  return { todaySteps: today?.stepCount, target, progress: today ? Math.min(1, Math.max(0, today.stepCount / target)) : 0 }
}

export function calculateDailyRollingSeries(records: WeightRecord[], endDate: string, days: number): Array<DailyWeightPoint & { average?: number }> {
  const startDate = shiftLocalDate(endDate, -(days - 1))
  return selectDailyWeights(records).filter((point) => point.localDate >= startDate && point.localDate <= endDate).map((point) => ({
    ...point,
    average: calculateRollingWeightAverage(records, point.localDate, 7),
  }))
}
