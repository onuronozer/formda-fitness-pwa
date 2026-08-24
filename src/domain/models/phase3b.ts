import type {
  CardioSessionStatus,
  HealthGateStatus,
  HydrationTargetSource,
  IntervalDifficulty,
  IntervalModality,
  StepGoalMode,
  SyncStatus,
  WaterSource,
} from '../enums'
import type { EntityMetadata } from './common'

export interface WaterRecord extends EntityMetadata {
  userId: string
  amountMl: number
  consumedAt: string
  localDate: string
  source: WaterSource
}

export interface DailyHydrationTarget extends EntityMetadata {
  userId: string
  localDate: string
  targetMl: number
  source: HydrationTargetSource
  ruleVersion: number
}

export interface DailyGoalSettings extends EntityMetadata {
  userId: string
  stepMode: StepGoalMode
  manualStepTarget?: number
  currentStepBaseline: number
  hydrationMode: 'program' | 'manual' | 'fluid_restriction'
  manualHydrationTargetMl?: number
}

export interface DailyGoalPlan extends EntityMetadata {
  userId: string
  localDate: string
  hydrationTargetMl: number
  stepTarget: number
  workoutTarget: 'workout' | 'rest' | 'unavailable'
  workoutDayId?: string
  cardioTarget: 'interval' | 'none'
  intervalProtocolId?: string
  generatedByVersion: number
  healthStatusAtGeneration: HealthGateStatus
  reasons: string[]
  generatedAt: string
}

export interface IntervalProtocol extends EntityMetadata {
  name: string
  modality: IntervalModality
  difficulty: IntervalDifficulty
  warmupSeconds: number
  workSeconds: number
  recoverySeconds: number
  rounds: number
  cooldownSeconds: number
  intensityLabel: string
  allowedWhenModified: boolean
  active: boolean
  ruleVersion: number
}

export interface CardioSession extends EntityMetadata {
  userId: string
  protocolId: string
  localDate: string
  startedAt: string
  completedAt?: string
  roundsCompleted: number
  status: CardioSessionStatus
  perceivedDifficulty?: number
  feedback?: string
}

export interface ShortcutActionReceipt extends EntityMetadata {
  userId: string
  actionId: string
  action: 'water'
  amountMl: number
  processedAt: string
}

export type SyncEntityType =
  | 'userProfiles' | 'healthProfiles' | 'healthConditions' | 'conditionAnswers'
  | 'weightRecords' | 'waistRecords' | 'stepRecords' | 'healthEvaluationLogs'
  | 'dailyHealthChecks' | 'dailyHealthResponses' | 'preWorkoutChecks'
  | 'workoutPlans' | 'workoutDays' | 'workoutExercises' | 'workoutSessions' | 'workoutSets'
  | 'waterRecords' | 'dailyHydrationTargets' | 'dailyGoalSettings' | 'dailyGoalPlans' | 'cardioSessions'

export interface SyncOutboxEvent extends EntityMetadata {
  userId: string
  entityType: SyncEntityType
  entityId: string
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown>
  status: SyncStatus
  attempts: number
  nextAttemptAt: string
  lastErrorCode?: string
  idempotencyKey: string
}

export interface CloudSyncPreference extends EntityMetadata {
  userId: string
  enabled: boolean
  cloudUserId?: string
  email?: string
  clientId: string
  lastSyncedAt?: string
  lastPulledAt?: string
  syncStatus: SyncStatus | 'offline' | 'disabled' | 'verification_required' | 'authentication_required' | 'deletion_partial'
  syncError?: string
}

export type WorkspaceOwnerType = 'LOCAL_ONLY' | 'AUTHENTICATED'
export type WorkspaceState = 'ACTIVE' | 'INACTIVE' | 'DELETION_PENDING'

export interface LocalWorkspace extends EntityMetadata {
  ownerType: WorkspaceOwnerType
  state: WorkspaceState
  localUserId?: string
  authUid?: string
  authEmail?: string
}

export interface SyncConflictAudit extends EntityMetadata {
  workspaceId: string
  localUserId: string
  entityType: SyncEntityType
  entityId: string
  localVersion: number
  remoteVersion: number
  winner: 'local' | 'remote' | 'equal'
  reason: 'missing_local' | 'higher_version' | 'newer_timestamp' | 'tombstone' | 'content_tiebreaker' | 'equal'
  resolvedAt: string
}
