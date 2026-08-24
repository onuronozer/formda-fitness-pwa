import { DEFAULT_DAILY_STEP_TARGET } from '../config/measurements'
import { buildStepMetrics, buildWaistMetrics, buildWeightMetrics, calculateDailyRollingSeries, compareMeasurementRecency, type DailyWeightPoint } from '../domain/measurements/analytics'
import type { StepRecord, WaistRecord, WeightRecord } from '../domain/models'
import { MeasurementRepository } from '../db/repositories'
import { shiftLocalDate } from '../utils/localDate'

function uniqueById<T extends { id: string }>(records: Array<T | undefined>): T[] {
  return [...new Map(records.filter((record): record is T => Boolean(record)).map((record) => [record.id, record])).values()]
}

export interface ChartPoint {
  localDate: string
  value: number
  average?: number
}

function dailyLatest<T extends { id: string; localDate: string; measuredAt: string; createdAt: string }>(records: T[], value: (record: T) => number): ChartPoint[] {
  const daily = new Map<string, T>()
  for (const record of [...records].sort(compareMeasurementRecency)) daily.set(record.localDate, record)
  const points = [...daily.values()].sort((a, b) => a.localDate.localeCompare(b.localDate)).map((record) => ({ localDate: record.localDate, value: value(record) }))
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 6), index + 1)
    return { ...point, average: Math.round(window.reduce((sum, item) => sum + item.value, 0) / window.length * 100) / 100 }
  })
}

function dailySteps(records: StepRecord[]): ChartPoint[] {
  const sums = new Map<string, number>()
  for (const record of records.filter((item) => !item.deletedAt)) sums.set(record.localDate, (sums.get(record.localDate) ?? 0) + record.stepCount)
  const points = [...sums.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([localDate, value]) => ({ localDate, value }))
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 6), index + 1)
    return { ...point, average: Math.round(window.reduce((sum, item) => sum + item.value, 0) / window.length) }
  })
}

export class MeasurementDashboardService {
  constructor(private readonly repository = new MeasurementRepository()) {}

  async getTodaySummary(userId: string, targetWeight: number, localDate: string) {
    const windowStart = shiftLocalDate(localDate, -13)
    const [startingWeight, latestWeight, windowWeights, startingWaist, latestWaist, steps] = await Promise.all([
      this.repository.getStartingWeight(userId), this.repository.getLatestWeight(userId), this.repository.listWeights(userId, windowStart, localDate),
      this.repository.getStartingWaist(userId), this.repository.getLatestWaist(userId), this.repository.listSteps(userId, localDate, localDate),
    ])
    return {
      weight: buildWeightMetrics(uniqueById([startingWeight, latestWeight, ...windowWeights]), targetWeight, localDate),
      waist: buildWaistMetrics(uniqueById([startingWaist, latestWaist])),
      steps: buildStepMetrics(steps, localDate, DEFAULT_DAILY_STEP_TARGET),
    }
  }

  async getProgress(userId: string, targetWeight: number, endDate: string, days: number) {
    const startDate = shiftLocalDate(endDate, -(days - 1))
    const queryStart = shiftLocalDate(startDate, -6)
    const [startingWeight, latestWeight, weights, startingWaist, latestWaist, waists, steps] = await Promise.all([
      this.repository.getStartingWeight(userId), this.repository.getLatestWeight(userId), this.repository.listWeights(userId, queryStart, endDate),
      this.repository.getStartingWaist(userId), this.repository.getLatestWaist(userId), this.repository.listWaists(userId, queryStart, endDate),
      this.repository.listSteps(userId, queryStart, endDate),
    ])
    const weightRecords = uniqueById([startingWeight, latestWeight, ...weights])
    const weightSeries: ChartPoint[] = calculateDailyRollingSeries(weights, endDate, days).filter((point) => point.localDate >= startDate).map((point: DailyWeightPoint & { average?: number }) => ({ localDate: point.localDate, value: point.valueKg, average: point.average }))
    return {
      startDate,
      weight: { metrics: buildWeightMetrics(weightRecords, targetWeight, endDate), series: weightSeries, history: weights.filter((record) => record.localDate >= startDate).reverse() as WeightRecord[] },
      waist: { metrics: buildWaistMetrics(uniqueById([startingWaist, latestWaist])), series: dailyLatest(waists, (record) => record.valueCm).filter((point) => point.localDate >= startDate), history: waists.filter((record) => record.localDate >= startDate).reverse() as WaistRecord[] },
      steps: { metrics: buildStepMetrics(steps, endDate, DEFAULT_DAILY_STEP_TARGET), series: dailySteps(steps).filter((point) => point.localDate >= startDate), history: steps.filter((record) => record.localDate >= startDate).reverse() as StepRecord[], target: DEFAULT_DAILY_STEP_TARGET },
    }
  }
}
