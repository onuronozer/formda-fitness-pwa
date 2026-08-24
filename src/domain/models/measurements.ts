import type { MeasurementSource } from '../enums'
import type { EntityMetadata } from './common'

export interface WeightRecord extends EntityMetadata {
  userId: string
  valueKg: number
  measuredAt: string
  localDate: string
  source: MeasurementSource
  note?: string
}

export interface WaistRecord extends EntityMetadata {
  userId: string
  valueCm: number
  measuredAt: string
  localDate: string
  source: MeasurementSource
  note?: string
}

export interface StepRecord extends EntityMetadata {
  userId: string
  stepCount: number
  measuredAt: string
  localDate: string
  source: MeasurementSource
}
