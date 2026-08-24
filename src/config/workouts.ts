export const EXERCISE_SEED_VERSION = 2
export const PROGRESSION_MAX_AVERAGE_RPE = 8
import { PROGRAM_CONFIG } from './program'

export const DEFAULT_TARGET_RPE = PROGRAM_CONFIG.beginnerDefaults.targetRpe
export const MODIFIED_TARGET_RPE = PROGRAM_CONFIG.modifiedDefaults.targetRpe
export const DEFAULT_WORKING_SETS = PROGRAM_CONFIG.beginnerDefaults.targetSets
export const MODIFIED_WORKING_SETS = PROGRAM_CONFIG.modifiedDefaults.targetSets
export const DEFAULT_REP_RANGE = { min: PROGRAM_CONFIG.beginnerDefaults.repMin, max: PROGRAM_CONFIG.beginnerDefaults.repMax }
export const DEFAULT_REST_SECONDS = PROGRAM_CONFIG.beginnerDefaults.restSeconds
export const SCHEDULED_WEEKDAYS = PROGRAM_CONFIG.scheduledWeekdays
export { PROGRAM_CONFIG, PROGRAM_RULES_VERSION, SUPPORTED_TRAINING_DAYS, availableEquipmentForProfile, isSupportedTrainingDays, programRules } from './program'
export { PROGRAM_CONFIG as ProgramConfig } from './program'
