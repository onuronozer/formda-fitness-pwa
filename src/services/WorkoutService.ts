import { createEntityMetadata, type HealthEvaluationLog, type WorkoutDay, type WorkoutExercise, type WorkoutPlan, type WorkoutSet } from '../domain/models'
import { ExerciseRepository, UserRepository, WorkoutRepository } from '../db/repositories'
import { appDb, type FormdaDatabase } from '../db/database'
import { WorkoutPlanValidator, WorkoutRuleEngine } from '../rules/workout'
import { PROGRAM_RULES_VERSION } from '../config/program'
import { ensureSeedVersions } from '../seed/seedService'
import { SyncQueue } from '../sync/SyncQueue'

export class WorkoutService {
  private readonly exercises: ExerciseRepository
  private readonly users: UserRepository
  private readonly workouts: WorkoutRepository
  private readonly queue: SyncQueue

  constructor(db: FormdaDatabase = appDb, private readonly engine = new WorkoutRuleEngine(), private readonly validator = new WorkoutPlanValidator()) {
    this.db = db
    this.exercises = new ExerciseRepository(db); this.users = new UserRepository(db); this.workouts = new WorkoutRepository(db); this.queue = new SyncQueue(db)
  }

  private readonly db: FormdaDatabase

  async generatePlan(userId: string, evaluation: Pick<HealthEvaluationLog, 'status' | 'reasons' | 'triggeredRuleIds' | 'evaluatedAt' | 'rulesVersion' | 'debugEntries' | 'matchedRules' | 'attentionLevel'>) {
    await ensureSeedVersions(this.db)
    const profile = await this.users.getById(userId)
    if (!profile) throw new Error('Profil bulunamadı.')
    const exercises = await this.exercises.list()
    const considerations = await this.exercises.getConsiderations(exercises.map((exercise) => exercise.id))
    const evidenceReferences = await this.db.evidenceReferences.toArray()
    const healthEvaluation = { ...evaluation, triggeredRules: evaluation.triggeredRuleIds }
    const generated = this.engine.generate(profile, healthEvaluation, exercises, considerations, evidenceReferences)
    const validation = this.validator.validate({ user: profile, healthEvaluation, candidate: generated, exercises, considerations, evidenceReferences })
    if (!validation.valid) return { generated: { ...generated, allowed: false }, validation }

    const now = new Date().toISOString()
    const plan: WorkoutPlan = {
      ...createEntityMetadata(now), userId, name: `${generated.days.length} Günlük Temel Program`, goal: profile.primaryGoal,
      daysPerWeek: generated.days.length, healthStatusAtGeneration: generated.status, active: true,
      generatedByRuleVersion: PROGRAM_RULES_VERSION, validationResult: validation, validatedAt: now,
    }
    const days: WorkoutDay[] = generated.days.map((day, dayIndex) => ({ ...createEntityMetadata(now), id: crypto.randomUUID(), workoutPlanId: plan.id, dayIndex, scheduledWeekday: day.scheduledWeekday, name: day.name }))
    const workoutExercises: WorkoutExercise[] = generated.days.flatMap((day, dayIndex) => day.exercises.map((exercise, order) => ({
      ...createEntityMetadata(now), id: crypto.randomUUID(), workoutDayId: days[dayIndex].id, exerciseId: exercise.exerciseId, order,
      targetSets: exercise.targetSets, targetRepMin: exercise.targetRepMin, targetRepMax: exercise.targetRepMax, targetRpe: exercise.targetRpe,
      restSeconds: exercise.restSeconds, modified: exercise.modified,
    })))
    await this.workouts.savePlan(plan, days, workoutExercises)
    return { generated, validation, plan, days, exercises: workoutExercises }
  }

  async getToday(userId: string, localDate: string) {
    const plan = await this.workouts.getActivePlan(userId)
    if (!plan?.validationResult?.valid) return { plan: undefined, day: undefined, exercises: [] as WorkoutExercise[] }
    const weekday = new Date(`${localDate}T12:00:00`).getDay()
    const days = await this.workouts.listDays(plan.id)
    const day = days.find((candidate) => candidate.scheduledWeekday === weekday)
    return { plan, day, exercises: day ? await this.workouts.listDayExercises(day.id) : [] }
  }

  async getPlanOverview(userId: string) {
    const plan = await this.workouts.getActivePlan(userId)
    if (!plan?.validationResult?.valid) return undefined
    const days = await this.workouts.listDays(plan.id)
    const allExercises = await this.exercises.list()
    const dayViews = await Promise.all(days.map(async (day) => {
      const targets = await this.workouts.listDayExercises(day.id)
      return { day, targets, exercises: targets.map((target) => allExercises.find((exercise) => exercise.id === target.exerciseId)).filter(Boolean) }
    }))
    return { plan, days: dayViews }
  }

  async getTodayView(userId: string, localDate: string) {
    const result = await this.getToday(userId, localDate)
    if (!result.day) return { ...result, session: undefined, exerciseDetails: [] }
    const allExercises = await this.exercises.list()
    const session = await this.workouts.getLatestSessionForDay(userId, localDate, result.day.id)
    return { ...result, session, exerciseDetails: result.exercises.map((target) => allExercises.find((exercise) => exercise.id === target.exerciseId)).filter(Boolean) }
  }

  async getSessionView(sessionId: string) {
    const session = await this.workouts.getSession(sessionId)
    if (!session) return undefined
    const day = await this.workouts.getDay(session.workoutDayId)
    if (!day) return undefined
    const targets = await this.workouts.listDayExercises(day.id)
    const allExercises = await this.exercises.list()
    const sets = await this.workouts.listSets(session.id)
    return { session, day, targets, exercises: targets.map((target) => allExercises.find((exercise) => exercise.id === target.exerciseId)).filter(Boolean), sets }
  }

  async startSession(userId: string, workoutDayId: string, localDate: string, healthEvaluationId: string, preWorkoutCheckId?: string) {
    const existing = await this.workouts.getLatestSessionForDay(userId, localDate, workoutDayId)
    if (existing && existing.status === 'in_progress') return existing
    const day = await this.workouts.getDay(workoutDayId)
    const plan = day ? await this.workouts.getPlan(day.workoutPlanId) : undefined
    if (!day || !plan || plan.userId !== userId || !plan.active || !plan.validationResult?.valid) throw new Error('Doğrulanmış aktif antrenman planı bulunamadı.')
    if (!preWorkoutCheckId) throw new Error('Antrenman öncesi kontrol gerekli.')
    const preWorkout = await this.db.preWorkoutChecks.get(preWorkoutCheckId)
    const evaluation = await this.db.healthEvaluationLogs.get(healthEvaluationId)
    if (!preWorkout || preWorkout.userId !== userId || preWorkout.localDate !== localDate || preWorkout.workoutSessionId) throw new Error('Geçerli bir antrenman öncesi kontrol gerekli.')
    if (!evaluation || preWorkout.healthEvaluationId !== evaluation.id || evaluation.preWorkoutCheckId !== preWorkout.id) throw new Error('Antrenman öncesi değerlendirme doğrulanamadı.')
    if (evaluation.status === 'RED_FLAG_BLOCKED' || evaluation.status === 'MEDICAL_REVIEW_REQUIRED') throw new Error('Sağlık değerlendirmesi antrenman başlangıcına izin vermiyor.')
    const session = { ...createEntityMetadata(), userId, workoutDayId, localDate, healthEvaluationId, preWorkoutCheckId, startedAt: new Date().toISOString(), status: 'in_progress' as const }
    const saved = await this.workouts.addSession(session)
    const linkedCheck = { ...preWorkout, workoutSessionId: saved.id, updatedAt: saved.startedAt, version: preWorkout.version + 1 }
    await this.db.transaction('rw', [this.db.preWorkoutChecks, this.db.syncOutbox], async () => { await this.db.preWorkoutChecks.put(linkedCheck); await this.queue.enqueue(userId, 'preWorkoutChecks', linkedCheck as typeof linkedCheck & Record<string, unknown>) })
    return saved
  }

  async saveSet(input: Omit<WorkoutSet, keyof ReturnType<typeof createEntityMetadata>>) {
    return this.workouts.upsertSet({ ...createEntityMetadata(), ...input })
  }

  async completeSession(id: string) { return this.workouts.updateSession(id, { status: 'completed', completedAt: new Date().toISOString() }) }
  async stopForHealth(id: string) { return this.workouts.updateSession(id, { status: 'stopped_for_health', completedAt: new Date().toISOString() }) }
}
