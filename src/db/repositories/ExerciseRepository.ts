import type { Exercise, ExerciseHealthConsideration } from '../../domain/models'
import type { MovementPattern } from '../../domain/enums'
import { ensureExerciseSeed } from '../../seed/seedService'
import { appDb, type FormdaDatabase } from '../database'

export interface ExerciseFilters {
  query?: string
  muscleId?: string
  equipmentId?: string
  movementPattern?: MovementPattern | ''
}

export class ExerciseRepository {
  constructor(private readonly db: FormdaDatabase = appDb) {}

  async list(filters: ExerciseFilters = {}): Promise<Exercise[]> {
    await ensureExerciseSeed(this.db)
    const query = filters.query?.trim().toLocaleLowerCase('tr-TR')
    return (await this.db.exercises.toArray()).filter((exercise) => exercise.active &&
      (!query || exercise.name.toLocaleLowerCase('tr-TR').includes(query))
      && (!filters.muscleId || exercise.primaryMuscleIds.includes(filters.muscleId) || exercise.secondaryMuscleIds.includes(filters.muscleId))
      && (!filters.equipmentId || exercise.equipmentIds.includes(filters.equipmentId))
      && (!filters.movementPattern || exercise.movementPattern === filters.movementPattern),
    ).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }

  async getById(id: string) { await ensureExerciseSeed(this.db); return this.db.exercises.get(id) }
  async listMuscles() { await ensureExerciseSeed(this.db); return (await this.db.muscles.toArray()).filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, 'tr')) }
  async listEquipment() { await ensureExerciseSeed(this.db); return (await this.db.equipment.toArray()).filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, 'tr')) }
  async getConsiderations(exerciseIds?: string[]): Promise<ExerciseHealthConsideration[]> {
    await ensureExerciseSeed(this.db)
    const all = await this.db.exerciseHealthConsiderations.toArray()
    return exerciseIds ? all.filter((item) => exerciseIds.includes(item.exerciseId)) : all
  }
  async getVerifiedMedia(exerciseId: string) {
    await ensureExerciseSeed(this.db)
    return this.db.exerciseMedia.where('[exerciseId+status]').equals([exerciseId, 'VERIFIED']).first()
  }
  async getMedia(exerciseId: string) { await ensureExerciseSeed(this.db); return this.db.exerciseMedia.where('exerciseId').equals(exerciseId).toArray() }
}
