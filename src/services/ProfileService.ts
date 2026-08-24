import type { ConditionAnswer, HealthCondition, HealthEvaluationLog, HealthProfile, UserProfile, WeightRecord } from '../domain/models'
import { createEntityMetadata } from '../domain/models'
import { compareMeasurementRecency } from '../domain/measurements/analytics'
import { appDb, type FormdaDatabase } from '../db/database'
import { HealthRiskEngine, type HealthRiskResult } from '../rules/health'
import type { OnboardingDraft } from '../stores/onboardingStore'
import { userProfileInputSchema } from '../validation/profileSchemas'
import { toLocalDate } from '../utils/localDate'
import { SyncQueue } from '../sync/SyncQueue'
import { WorkspaceService } from './WorkspaceService'

export interface ProfileSnapshot {
  profile: UserProfile
  healthProfile: HealthProfile
  conditions: HealthCondition[]
  answers: ConditionAnswer[]
}

export class ProfileService {
  private readonly queue: SyncQueue
  private readonly workspaces: WorkspaceService
  constructor(private readonly db: FormdaDatabase = appDb, private readonly engine = new HealthRiskEngine()) { this.queue = new SyncQueue(db); this.workspaces = new WorkspaceService(db) }

  async load(userId: string): Promise<ProfileSnapshot | undefined> {
    const profile = await this.db.userProfiles.get(userId)
    if (!profile || profile.deletedAt) return undefined
    const healthProfile = await this.db.healthProfiles.where('userId').equals(userId).filter((item) => !item.deletedAt).first()
    if (!healthProfile) return undefined
    const conditions = await this.db.healthConditions.where('userId').equals(userId).filter((item) => !item.deletedAt).toArray()
    const answers = await this.db.conditionAnswers.where('userId').equals(userId).filter((item) => !item.deletedAt).toArray()
    return { profile, healthProfile, conditions, answers }
  }

  toDraft(snapshot: ProfileSnapshot): OnboardingDraft {
    const healthAnswers: OnboardingDraft['healthAnswers'] = {}
    for (const answer of snapshot.answers) {
      healthAnswers[`${snapshot.conditions.find((condition) => condition.id === answer.conditionId)?.conditionType}.${answer.questionKey}`] =
        answer.booleanValue ?? answer.numberValue
    }
    return {
      displayName: snapshot.profile.displayName,
      birthDate: snapshot.profile.birthDate,
      sex: snapshot.profile.sex,
      heightCm: String(snapshot.profile.heightCm),
      currentWeightKg: String(snapshot.profile.currentWeightKg),
      targetWeightKg: String(snapshot.profile.targetWeightKg),
      waistCm: snapshot.profile.waistCm ? String(snapshot.profile.waistCm) : '',
      primaryGoal: snapshot.profile.primaryGoal,
      experienceLevel: snapshot.profile.experienceLevel,
      trainingDaysPerWeek: snapshot.profile.trainingDaysPerWeek,
      trainingLocation: snapshot.profile.trainingLocation,
      availableEquipment: snapshot.profile.availableEquipment,
      selectedConditions: snapshot.conditions.filter((condition) => condition.active).map((condition) => condition.conditionType),
      healthAnswers,
    }
  }

  buildSnapshot(draft: OnboardingDraft, existing?: ProfileSnapshot): ProfileSnapshot {
    const input = userProfileInputSchema.parse({
      ...draft,
      waistCm: draft.waistCm === '' ? undefined : draft.waistCm,
    })
    const now = new Date().toISOString()
    const userMetadata = existing ? {
      ...existing.profile,
      updatedAt: now,
      version: existing.profile.version + 1,
    } : createEntityMetadata(now)
    const profile: UserProfile = { ...userMetadata, ...input }

    const healthProfile: HealthProfile = existing ? {
      ...existing.healthProfile,
      updatedAt: now,
      version: existing.healthProfile.version + 1,
    } : { ...createEntityMetadata(now), userId: profile.id }

    const conditions = draft.selectedConditions.map((conditionType): HealthCondition => {
      const previous = existing?.conditions.find((condition) => condition.conditionType === conditionType)
      return {
        ...(previous ? { ...previous, updatedAt: now, version: previous.version + 1 } : createEntityMetadata(now)),
        userId: profile.id,
        healthProfileId: healthProfile.id,
        conditionType,
        active: true,
      }
    })

    const answers: ConditionAnswer[] = []
    for (const condition of conditions) {
      for (const [compoundKey, value] of Object.entries(draft.healthAnswers)) {
        const [conditionType, questionKey] = compoundKey.split('.')
        if (conditionType !== condition.conditionType || value === undefined) continue
        const previous = existing?.answers.find((answer) => answer.conditionId === condition.id && answer.questionKey === questionKey)
        answers.push({
          ...(previous ? { ...previous, updatedAt: now, version: previous.version + 1 } : createEntityMetadata(now)),
          userId: profile.id,
          conditionId: condition.id,
          questionKey,
          ...(typeof value === 'boolean' ? { booleanValue: value, numberValue: undefined } : { numberValue: value, booleanValue: undefined }),
        })
      }
    }
    return { profile, healthProfile, conditions, answers }
  }

  evaluate(snapshot: ProfileSnapshot): HealthRiskResult {
    return this.engine.evaluate({ conditions: snapshot.conditions, answers: snapshot.answers })
  }

  async save(draft: OnboardingDraft, existing?: ProfileSnapshot): Promise<{ snapshot: ProfileSnapshot; evaluation: HealthRiskResult }> {
    const latestWeight = existing
      ? await this.db.weightRecords.where('userId').equals(existing.profile.id).filter((record) => !record.deletedAt).toArray().then((records) => records.sort(compareMeasurementRecency).at(-1))
      : undefined
    const effectiveDraft = existing && latestWeight ? { ...draft, currentWeightKg: String(latestWeight.valueKg) } : draft
    const snapshot = this.buildSnapshot(effectiveDraft, existing)
    const evaluation = this.evaluate(snapshot)
    const log: HealthEvaluationLog = {
      ...createEntityMetadata(evaluation.evaluatedAt),
      userId: snapshot.profile.id,
      evaluatedAt: evaluation.evaluatedAt,
      rulesVersion: evaluation.rulesVersion,
      status: evaluation.status,
      triggeredRuleIds: evaluation.triggeredRules,
      reasons: evaluation.reasons,
      debugEntries: evaluation.debugEntries,
      matchedRules: evaluation.matchedRules,
      attentionLevel: evaluation.attentionLevel,
    }

    const initialWeight: WeightRecord | undefined = existing ? undefined : {
      ...createEntityMetadata(snapshot.profile.createdAt),
      userId: snapshot.profile.id,
      valueKg: snapshot.profile.currentWeightKg,
      measuredAt: snapshot.profile.createdAt,
      localDate: toLocalDate(snapshot.profile.createdAt),
      source: 'manual',
      note: 'Başlangıç ölçümü',
    }

    await this.db.transaction('rw', [this.db.userProfiles, this.db.healthProfiles, this.db.healthConditions, this.db.conditionAnswers, this.db.healthEvaluationLogs, this.db.weightRecords, this.db.syncOutbox], async () => {
      await this.db.userProfiles.put(snapshot.profile)
      await this.db.healthProfiles.put(snapshot.healthProfile)
      const oldConditions = await this.db.healthConditions.where('userId').equals(snapshot.profile.id).toArray()
      const oldAnswers = await this.db.conditionAnswers.where('userId').equals(snapshot.profile.id).toArray()
      const currentConditionIds = new Set(snapshot.conditions.map((item) => item.id)); const currentAnswerIds = new Set(snapshot.answers.map((item) => item.id))
      const retiredConditions = oldConditions.filter((item) => !currentConditionIds.has(item.id) && !item.deletedAt).map((item) => ({ ...item, deletedAt: log.createdAt, updatedAt: log.createdAt, version: item.version + 1 }))
      const retiredAnswers = oldAnswers.filter((item) => !currentAnswerIds.has(item.id) && !item.deletedAt).map((item) => ({ ...item, deletedAt: log.createdAt, updatedAt: log.createdAt, version: item.version + 1 }))
      if (retiredConditions.length) await this.db.healthConditions.bulkPut(retiredConditions)
      if (retiredAnswers.length) await this.db.conditionAnswers.bulkPut(retiredAnswers)
      if (snapshot.conditions.length) await this.db.healthConditions.bulkPut(snapshot.conditions)
      if (snapshot.answers.length) await this.db.conditionAnswers.bulkPut(snapshot.answers)
      await this.db.healthEvaluationLogs.put(log)
      if (initialWeight) await this.db.weightRecords.add(initialWeight)
      await this.queue.enqueue(snapshot.profile.id, 'userProfiles', snapshot.profile as UserProfile & Record<string, unknown>)
      await this.queue.enqueue(snapshot.profile.id, 'healthProfiles', snapshot.healthProfile as HealthProfile & Record<string, unknown>)
      for (const item of [...retiredConditions, ...snapshot.conditions]) await this.queue.enqueue(snapshot.profile.id, 'healthConditions', item as HealthCondition & Record<string, unknown>)
      for (const item of [...retiredAnswers, ...snapshot.answers]) await this.queue.enqueue(snapshot.profile.id, 'conditionAnswers', item as ConditionAnswer & Record<string, unknown>)
      await this.queue.enqueue(snapshot.profile.id, 'healthEvaluationLogs', log as HealthEvaluationLog & Record<string, unknown>)
      if (initialWeight) await this.queue.enqueue(snapshot.profile.id, 'weightRecords', initialWeight as WeightRecord & Record<string, unknown>)
    })
    await this.workspaces.claimProfile(snapshot.profile.id)

    return { snapshot, evaluation }
  }
}
