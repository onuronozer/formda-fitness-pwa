import type { HealthConditionType, HealthGateStatus } from '../enums'
import type { EntityMetadata } from './common'

export interface DailyHealthCheck extends EntityMetadata {
  userId: string
  localDate: string
  checkedAt: string
  revision: number
  supersedesId?: string
  overallPain: number
  energyLevel: number
  unusualSymptoms: boolean
  initialHighBpDetected?: boolean
  repeatBpRequired?: boolean
  repeatSystolic?: number
  repeatDiastolic?: number
  initialBpMeasuredAt?: string
  repeatBpMeasuredAt?: string
}

export interface DailyHealthResponse extends EntityMetadata {
  userId: string
  healthCheckId: string
  conditionType: HealthConditionType
  questionKey: string
  booleanValue?: boolean
  numberValue?: number
}

export interface PreWorkoutCheck extends EntityMetadata {
  userId: string
  workoutSessionId?: string
  dailyHealthCheckId: string
  checkedAt: string
  localDate: string
  conditionChangedSinceDailyCheck: boolean
  newSymptoms: boolean
  bladderChange?: boolean
  bowelChange?: boolean
  saddleNumbness?: boolean
  progressiveMotorWeakness?: boolean
  resultingHealthStatus: HealthGateStatus
  healthEvaluationId?: string
}
