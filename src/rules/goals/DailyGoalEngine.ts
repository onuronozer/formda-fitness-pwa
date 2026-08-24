import { DAILY_GOAL_CONFIG, DAILY_GOAL_RULE_VERSION } from '../../config/phase3b'
import type { HealthGateStatus } from '../../domain/enums'
import type { DailyGoalPlan, DailyGoalSettings } from '../../domain/models'

export interface DailyGoalEngineInput {
  userId: string
  localDate: string
  healthStatus: HealthGateStatus
  recentSteps: Array<{ localDate: string; steps: number }>
  settings: DailyGoalSettings
  hydrationTargetMl: number
  workoutDayId?: string
  intervalProtocolId?: string
  previousTodayPlan?: DailyGoalPlan
  now?: string
}

const round = (value: number) => Math.round(value / DAILY_GOAL_CONFIG.stepTarget.roundTo) * DAILY_GOAL_CONFIG.stepTarget.roundTo
const clamp = (value: number) => Math.min(DAILY_GOAL_CONFIG.stepTarget.max, Math.max(DAILY_GOAL_CONFIG.stepTarget.min, round(value)))

export class DailyGoalEngine {
  generate(input: DailyGoalEngineInput): Omit<DailyGoalPlan, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'schemaVersion'> {
    const reasons: string[] = []
    let stepTarget: number

    if (input.settings.stepMode === 'manual') {
      stepTarget = input.settings.manualStepTarget ?? input.settings.currentStepBaseline
      reasons.push('STEP_MANUAL_OVERRIDE')
    } else if (input.recentSteps.length < DAILY_GOAL_CONFIG.minimumStepDataDays) {
      stepTarget = input.settings.currentStepBaseline
      reasons.push('STEP_INSUFFICIENT_DATA')
    } else {
      const average = round(input.recentSteps.reduce((sum, day) => sum + day.steps, 0) / input.recentSteps.length)
      const baseline = clamp(average)
      const completion = average / Math.max(input.settings.currentStepBaseline, 1)
      reasons.push('STEP_BASELINE_RULE')

      if (input.healthStatus === 'MEDICAL_REVIEW_REQUIRED' || input.healthStatus === 'RED_FLAG_BLOCKED') {
        stepTarget = Math.min(baseline, input.settings.currentStepBaseline)
        reasons.push('STEP_HEALTH_PROGRESSION_GATE')
      } else if (input.healthStatus === 'MODIFIED') {
        stepTarget = completion < DAILY_GOAL_CONFIG.regressionCompletionRatio ? baseline - DAILY_GOAL_CONFIG.stepTarget.regression : baseline
        reasons.push('STEP_MODIFIED_NO_PROGRESSION')
      } else if (completion >= DAILY_GOAL_CONFIG.progressionCompletionRatio) {
        stepTarget = baseline + DAILY_GOAL_CONFIG.stepTarget.progression
        reasons.push('STEP_PROGRESS_RULE')
      } else if (completion < DAILY_GOAL_CONFIG.regressionCompletionRatio) {
        stepTarget = baseline - DAILY_GOAL_CONFIG.stepTarget.regression
        reasons.push('STEP_REGRESSION_RULE')
      } else {
        stepTarget = baseline
        reasons.push('STEP_MAINTAIN_RULE')
      }
    }

    stepTarget = clamp(stepTarget)
    const healthAllowsActivity = input.healthStatus === 'NORMAL' || input.healthStatus === 'MODIFIED'
    const workoutTarget = !healthAllowsActivity ? 'unavailable' as const : input.workoutDayId ? 'workout' as const : 'rest' as const
    reasons.push(input.workoutDayId ? 'WORKOUT_DAY_RULE' : 'REST_DAY_RULE')
    const intervalEligible = input.healthStatus === 'NORMAL' && Boolean(input.intervalProtocolId) && !input.workoutDayId
    if (intervalEligible) reasons.push('INTERVAL_WALKING_BEGINNER')

    return {
      userId: input.userId,
      localDate: input.localDate,
      hydrationTargetMl: input.previousTodayPlan?.hydrationTargetMl ?? input.hydrationTargetMl,
      stepTarget,
      workoutTarget,
      workoutDayId: workoutTarget === 'workout' ? input.workoutDayId : undefined,
      cardioTarget: intervalEligible ? 'interval' : 'none',
      intervalProtocolId: intervalEligible ? input.intervalProtocolId : undefined,
      generatedByVersion: DAILY_GOAL_RULE_VERSION,
      healthStatusAtGeneration: input.healthStatus,
      reasons,
      generatedAt: input.now ?? new Date().toISOString(),
    }
  }
}
