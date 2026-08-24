import { createEntityMetadata, type DailyHealthResponse, type HealthEvaluationLog, type PreWorkoutCheck } from '../domain/models'
import { HealthCheckRepository, HealthProfileRepository } from '../db/repositories'
import { appDb, type FormdaDatabase } from '../db/database'
import { HealthRiskEngine, type HealthRiskResult } from '../rules/health'
import { dailyHealthInputSchema, preWorkoutInputSchema } from '../validation/healthCheckSchemas'
import { CLINICAL_SAFETY_CONFIG, isInitialBloodPressureHigh } from '../config/clinicalSafety'
import { SyncQueue } from '../sync/SyncQueue'

export class DailyHealthService {
  private readonly checks: HealthCheckRepository
  private readonly healthProfiles: HealthProfileRepository
  private readonly queue: SyncQueue

  constructor(private readonly db: FormdaDatabase = appDb, private readonly engine = new HealthRiskEngine(), private readonly now = () => new Date()) {
    this.checks = new HealthCheckRepository(db)
    this.healthProfiles = new HealthProfileRepository(db)
    this.queue = new SyncQueue(db)
  }

  async saveDailyCheck(userId: string, input: unknown) {
    const values = dailyHealthInputSchema.parse(input)
    const previous = await this.checks.getLatestDaily(userId, values.localDate)
    const nowDate = this.now()
    const now = nowDate.toISOString()
    const responseNumber = (key: string) => values.responses.find((response) => response.conditionType === 'hypertension' && response.questionKey === key)?.numberValue
    const responseBoolean = (key: string) => values.responses.find((response) => response.conditionType === 'hypertension' && response.questionKey === key)?.booleanValue === true
    const measured = responseBoolean('measured_bp_today')
    const initialHighNow = measured && isInitialBloodPressureHigh(responseNumber('systolic'), responseNumber('diastolic'))
    const repeatProvided = values.repeatSystolic !== undefined && values.repeatDiastolic !== undefined
    if (previous?.repeatBpRequired && !repeatProvided) throw new Error('Ölçümü en az 1 dakika sonra tekrar kontrol et.')
    if (!previous?.repeatBpRequired && repeatProvided) throw new Error('Tekrar ölçümü yalnız ilk yüksek ölçümden sonra kaydedilebilir.')
    if (previous?.repeatBpRequired) {
      const initialAt = previous.initialBpMeasuredAt ?? previous.checkedAt
      if (nowDate.getTime() - new Date(initialAt).getTime() < CLINICAL_SAFETY_CONFIG.bloodPressure.minimumRepeatDelayMs) throw new Error('Ölçümü en az 1 dakika sonra tekrar kontrol et.')
    }
    const initialHighBpDetected = previous?.repeatBpRequired ? true : initialHighNow
    const repeatBpRequired = initialHighBpDetected && !repeatProvided
    const check = {
      ...createEntityMetadata(now), userId, localDate: values.localDate, checkedAt: now,
      revision: (previous?.revision ?? 0) + 1, supersedesId: previous?.id,
      overallPain: values.overallPain, energyLevel: values.energyLevel, unusualSymptoms: values.unusualSymptoms,
      initialHighBpDetected, repeatBpRequired,
      repeatSystolic: repeatProvided ? values.repeatSystolic : undefined,
      repeatDiastolic: repeatProvided ? values.repeatDiastolic : undefined,
      initialBpMeasuredAt: initialHighBpDetected ? previous?.initialBpMeasuredAt ?? now : undefined,
      repeatBpMeasuredAt: repeatProvided ? now : undefined,
    }
    const responses: DailyHealthResponse[] = values.responses.map((response) => ({
      ...createEntityMetadata(now), userId, healthCheckId: check.id, conditionType: response.conditionType, questionKey: response.questionKey,
      booleanValue: response.booleanValue, numberValue: response.numberValue,
    }))
    await this.checks.saveDailyRevision(check, responses)
    const evaluation = await this.evaluate(userId, check, responses)
    const log = await this.saveEvaluation(userId, evaluation, 'daily', check.id)
    return { check, responses, evaluation, log }
  }

  async getLatest(userId: string, localDate: string) {
    const check = await this.checks.getLatestDaily(userId, localDate)
    if (!check) return undefined
    const responses = await this.checks.getResponses(check.id)
    const evaluation = await this.evaluate(userId, check, responses)
    return { check, responses, evaluation }
  }

  async createPreWorkout(userId: string, input: unknown) {
    const values = preWorkoutInputSchema.parse(input)
    const daily = await this.checks.getLatestDaily(userId, values.localDate)
    if (!daily || daily.id !== values.dailyHealthCheckId) throw new Error('Bugünkü sağlık kontrolü güncel değil.')
    const responses = await this.checks.getResponses(daily.id)
    const draft: PreWorkoutCheck = {
      ...createEntityMetadata(), userId, dailyHealthCheckId: daily.id, workoutSessionId: values.workoutSessionId,
      checkedAt: this.now().toISOString(), localDate: values.localDate, conditionChangedSinceDailyCheck: values.conditionChangedSinceDailyCheck,
      newSymptoms: values.newSymptoms, bladderChange: values.bladderChange, bowelChange: values.bowelChange,
      saddleNumbness: values.saddleNumbness, progressiveMotorWeakness: values.progressiveMotorWeakness, resultingHealthStatus: 'NORMAL',
    }
    const evaluation = await this.evaluate(userId, daily, responses, draft)
    const log = await this.saveEvaluation(userId, evaluation, 'pre_workout', daily.id, draft.id)
    const check = { ...draft, resultingHealthStatus: evaluation.status, healthEvaluationId: log.id }
    await this.checks.savePreWorkout(check)
    return { check, evaluation, log }
  }

  private async evaluate(userId: string, dailyCheck: Parameters<HealthRiskEngine['evaluate']>[0]['dailyCheck'], dailyResponses: DailyHealthResponse[], preWorkoutCheck?: PreWorkoutCheck) {
    const bundle = await this.healthProfiles.getForUser(userId)
    return this.engine.evaluate({ conditions: bundle?.conditions ?? [], answers: bundle?.answers ?? [], dailyCheck, dailyResponses, preWorkoutCheck })
  }

  private async saveEvaluation(userId: string, result: HealthRiskResult, contextType: HealthEvaluationLog['contextType'], dailyHealthCheckId?: string, preWorkoutCheckId?: string) {
    const log: HealthEvaluationLog = {
      ...createEntityMetadata(result.evaluatedAt), userId, evaluatedAt: result.evaluatedAt, rulesVersion: result.rulesVersion,
      status: result.status, triggeredRuleIds: result.triggeredRules, reasons: result.reasons, debugEntries: result.debugEntries,
      matchedRules: result.matchedRules, attentionLevel: result.attentionLevel,
      contextType, dailyHealthCheckId, preWorkoutCheckId,
    }
    await this.db.transaction('rw', [this.db.healthEvaluationLogs, this.db.syncOutbox], async () => { await this.db.healthEvaluationLogs.add(log); await this.queue.enqueue(userId, 'healthEvaluationLogs', log as HealthEvaluationLog & Record<string, unknown>) })
    return log
  }
}
