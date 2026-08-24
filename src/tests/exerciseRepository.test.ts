import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { FormdaDatabase } from '../db/database'
import { ExerciseRepository } from '../db/repositories'
import { validProfile } from './fixtures'

const names: string[] = []
const testName = () => { const name = `formda-exercise-${crypto.randomUUID()}`; names.push(name); return name }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('ExerciseRepository', () => {
  it('loads the curated core seed', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    expect(await repository.list()).toHaveLength(35)
    expect(await repository.listMuscles()).toHaveLength(16)
    expect(await repository.listEquipment()).toHaveLength(9)
    db.close()
  })

  it('keeps normalized muscle relations', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const squat = (await repository.list({ query: 'Bodyweight Squat' }))[0]
    const muscles = await repository.listMuscles()
    expect(muscles.filter((muscle) => squat.primaryMuscleIds.includes(muscle.id)).map((muscle) => muscle.slug)).toContain('quadriceps')
    db.close()
  })

  it('filters by equipment and movement pattern', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const cablePulls = await repository.list({ equipmentId: 'equipment-cable', movementPattern: 'horizontal_pull' })
    expect(cablePulls.map((exercise) => exercise.slug)).toContain('seated-cable-row')
    expect(cablePulls.every((exercise) => exercise.equipmentIds.includes('equipment-cable'))).toBe(true)
    db.close()
  })

  it('exposes progression, regression and substitution links', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const chair = (await repository.list({ query: 'Chair Squat' }))[0]
    const pushup = (await repository.list({ query: 'Push-Up' })).find((exercise) => exercise.slug === 'push-up')!
    expect(chair.progressionExerciseIds).toContain('exercise-bodyweight-squat')
    expect(pushup.regressionExerciseIds).toContain('exercise-assisted-push-up')
    expect(pushup.substitutionExerciseIds).toContain('exercise-dumbbell-bench-press')
    db.close()
  })

  it('returns VERIFIED media and hides PENDING media from the visible lookup', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    expect((await repository.getVerifiedMedia('exercise-push-up'))?.status).toBe('VERIFIED')
    expect(await repository.getVerifiedMedia('exercise-walking')).toBeUndefined()
    expect((await repository.getMedia('exercise-walking'))[0].status).toBe('PENDING')
    db.close()
  })

  it('keeps technique copy separate from unreviewed medical considerations', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const exercises = await repository.list()
    const considerations = await repository.getConsiderations()
    expect(considerations).toHaveLength(5)
    expect(considerations.every((item) => !item.reviewed && item.reviewStatus === 'PENDING')).toBe(true)
    expect(exercises.flatMap((exercise) => exercise.instructions).join(' ').toLocaleLowerCase('tr-TR')).not.toMatch(/bel fıtığı için güvenli|tansiyon için güvenli|medikal olarak güvenli/)
    db.close()
  })

  it('repairs a malformed legacy exercise seed even when its version is current', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const original = (await repository.list())[0]
    const malformed = structuredClone(original) as Partial<typeof original>
    delete malformed.primaryMuscleIds
    await db.exercises.put(malformed as typeof original)

    const repaired = await repository.list()
    expect(repaired).toHaveLength(35)
    expect(repaired.every((exercise) => Array.isArray(exercise.primaryMuscleIds))).toBe(true)
    db.close()
  })

  it('repairs malformed legacy muscle and equipment rows without touching user data', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    await repository.list()
    const profileId = crypto.randomUUID()
    await db.userProfiles.add({ ...validProfile, id: profileId, displayName: 'Test' })
    const muscle = (await db.muscles.toArray())[0]
    const equipment = (await db.equipment.toArray())[0]
    await db.muscles.put({ ...muscle, name: undefined } as unknown as typeof muscle)
    await db.equipment.put({ ...equipment, active: 'yes' } as unknown as typeof equipment)

    expect(await repository.listMuscles()).toHaveLength(16)
    expect(await repository.listEquipment()).toHaveLength(9)
    expect((await db.userProfiles.get(profileId))?.displayName).toBe('Test')
    db.close()
  })

  it('coalesces concurrent seed reads into one valid dataset', async () => {
    const db = new FormdaDatabase(testName()); const repository = new ExerciseRepository(db)
    const [exercises, muscles, equipment] = await Promise.all([
      repository.list(), repository.listMuscles(), repository.listEquipment(),
    ])
    expect([exercises.length, muscles.length, equipment.length]).toEqual([35, 16, 9])
    expect(await db.seedVersions.where('dataset').equals('exercises').count()).toBe(1)
    db.close()
  })
})
