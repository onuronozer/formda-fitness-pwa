export const PRIMARY_GOALS = ['weight_loss', 'fat_loss', 'muscle_gain', 'maintain', 'conditioning'] as const
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number]

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

export const TRAINING_LOCATIONS = ['home', 'gym', 'both'] as const
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number]

export const SEX_VALUES = ['female', 'male', 'unspecified'] as const
export type Sex = (typeof SEX_VALUES)[number]

export const HEALTH_CONDITION_TYPES = [
  'hypertension',
  'lumbar_disc_herniation',
  'diabetes',
  'knee_problem',
  'shoulder_problem',
  'cardiovascular_condition',
  'other',
] as const
export type HealthConditionType = (typeof HEALTH_CONDITION_TYPES)[number]

export const MEASUREMENT_SOURCES = ['manual', 'import', 'shortcut', 'healthkit', 'health_connect'] as const
export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number]

export const ACTIVE_MEASUREMENT_SOURCES = ['manual', 'import'] as const
export type ActiveMeasurementSource = (typeof ACTIVE_MEASUREMENT_SOURCES)[number]

export const DAILY_WEIGHT_STRATEGIES = ['latest', 'first', 'average'] as const
export type DailyWeightStrategy = (typeof DAILY_WEIGHT_STRATEGIES)[number]

export const WEIGHT_TRENDS = ['down', 'stable', 'up', 'insufficient_data'] as const
export type WeightTrend = (typeof WEIGHT_TRENDS)[number]

export const HEALTH_GATE_STATUSES = [
  'NORMAL',
  'MODIFIED',
  'MEDICAL_REVIEW_REQUIRED',
  'RED_FLAG_BLOCKED',
] as const
export type HealthGateStatus = (typeof HEALTH_GATE_STATUSES)[number]

export const EVIDENCE_TYPES = ['guideline', 'systematic_review', 'meta_analysis', 'randomized_trial'] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const RULE_TYPES = ['EVIDENCE_RULE', 'PRODUCT_SAFETY_RULE', 'PROGRAM_RULE'] as const
export type RuleType = (typeof RULE_TYPES)[number]

export const RULE_STATUSES = ['ACTIVE', 'INACTIVE', 'RETIRED'] as const
export type RuleStatus = (typeof RULE_STATUSES)[number]

export const REVIEW_STATUSES = ['PENDING', 'REVIEWED', 'RETIRED'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const EVIDENCE_VERIFICATION_STATUSES = ['VERIFIED', 'PENDING'] as const
export type EvidenceVerificationStatus = (typeof EVIDENCE_VERIFICATION_STATUSES)[number]

export const MOVEMENT_PATTERNS = [
  'squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'hip_extension', 'calf_raise',
  'core_anti_extension', 'core_anti_rotation', 'locomotion', 'cardio',
] as const
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const EXERCISE_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number]

export const EXERCISE_HEALTH_STATUSES = ['GENERAL', 'MODIFY', 'AVOID_WHEN_SYMPTOMATIC', 'PROFESSIONAL_REVIEW'] as const
export type ExerciseHealthStatus = (typeof EXERCISE_HEALTH_STATUSES)[number]

export const EXERCISE_MEDIA_STATUSES = ['VERIFIED', 'PENDING', 'UNAVAILABLE'] as const
export type ExerciseMediaStatus = (typeof EXERCISE_MEDIA_STATUSES)[number]
export const EXERCISE_MEDIA_TYPES = ['video', 'article'] as const
export type ExerciseMediaType = (typeof EXERCISE_MEDIA_TYPES)[number]
export const EXERCISE_MEDIA_OPEN_MODES = ['external', 'youtube_embed'] as const
export type ExerciseMediaOpenMode = (typeof EXERCISE_MEDIA_OPEN_MODES)[number]

export const WORKOUT_SESSION_STATUSES = ['in_progress', 'paused', 'completed', 'stopped_for_health'] as const
export type WorkoutSessionStatus = (typeof WORKOUT_SESSION_STATUSES)[number]
export const PAIN_LEVELS = ['none', 'mild', 'moderate', 'severe'] as const
export type PainLevel = (typeof PAIN_LEVELS)[number]

export const CLINICAL_RELEASE_STATUSES = ['DEVELOPMENT', 'EVIDENCE_VERIFIED', 'CLINICAL_REVIEW_PENDING', 'CLINICAL_REVIEWED', 'RELEASE_APPROVED'] as const
export type ClinicalReleaseStatus = (typeof CLINICAL_RELEASE_STATUSES)[number]

export const WATER_SOURCES = ['manual', 'quick_add', 'shortcut', 'import'] as const
export type WaterSource = (typeof WATER_SOURCES)[number]
export const HYDRATION_TARGET_SOURCES = ['program', 'manual', 'fluid_restriction'] as const
export type HydrationTargetSource = (typeof HYDRATION_TARGET_SOURCES)[number]
export const STEP_GOAL_MODES = ['adaptive', 'manual'] as const
export type StepGoalMode = (typeof STEP_GOAL_MODES)[number]

export const INTERVAL_MODALITIES = ['walking', 'running', 'cycling', 'elliptical'] as const
export type IntervalModality = (typeof INTERVAL_MODALITIES)[number]
export const INTERVAL_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type IntervalDifficulty = (typeof INTERVAL_DIFFICULTIES)[number]
export const CARDIO_SESSION_STATUSES = ['in_progress', 'completed', 'stopped_early'] as const
export type CardioSessionStatus = (typeof CARDIO_SESSION_STATUSES)[number]

export const SYNC_STATUSES = ['pending', 'syncing', 'synced', 'error'] as const
export type SyncStatus = (typeof SYNC_STATUSES)[number]
