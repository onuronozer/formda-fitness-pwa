export const HYDRATION_PROGRAM_VERSION = 1
export const HYDRATION_CONFIG = {
  quickAmountsMl: [200, 250, 330, 500],
  amountMl: { min: 50, max: 3_000, step: 10 },
  targetMl: { default: 2_400, min: 500, max: 8_000, step: 100 },
} as const

export const DAILY_GOAL_RULE_VERSION = 1
export const DAILY_GOAL_CONFIG = {
  recentDays: 7,
  minimumStepDataDays: 4,
  defaultStepBaseline: 6_000,
  stepTarget: { min: 2_000, max: 20_000, progression: 500, regression: 500, roundTo: 100 },
  progressionCompletionRatio: 0.85,
  regressionCompletionRatio: 0.6,
} as const

export const INTERVAL_RULE_VERSION = 1
export const WALKING_BEGINNER_PROTOCOL_ID = 'interval-walking-beginner-1'

export const phase3bProgramRules = [
  { id: 'HYDRATION_DEFAULT_TARGET', ruleType: 'PROGRAM_RULE', version: HYDRATION_PROGRAM_VERSION, rationale: 'V1 user-overridable product target; it is not a medical hydration prescription.' },
  { id: 'STEP_MINIMUM_DATA', ruleType: 'PROGRAM_RULE', version: DAILY_GOAL_RULE_VERSION, rationale: 'V1 waits for enough recent observations before adapting the step target.' },
  { id: 'STEP_ADAPTIVE_PROGRESS', ruleType: 'PROGRAM_RULE', version: DAILY_GOAL_RULE_VERSION, rationale: 'V1 product progression and regression increments.' },
  { id: 'STEP_HEALTH_PROGRESSION_GATE', ruleType: 'PRODUCT_SAFETY_RULE', version: DAILY_GOAL_RULE_VERSION, rationale: 'Conservative product policy: medical review and red-flag states do not receive progression.' },
  { id: 'INTERVAL_WALKING_BEGINNER', ruleType: 'PROGRAM_RULE', version: INTERVAL_RULE_VERSION, rationale: 'V1 walking interval programming choice, not a medical prescription.' },
] as const
