import type { DailyWeightStrategy } from '../domain/enums'

export const DEFAULT_DAILY_STEP_TARGET = 8_000
export const DEFAULT_DAILY_WEIGHT_STRATEGY: DailyWeightStrategy = 'latest'
export const WEIGHT_TREND_STABLE_THRESHOLD_KG = 0.2
export const PROGRESS_RANGES = [7, 30, 90] as const
export type ProgressRange = (typeof PROGRESS_RANGES)[number]
