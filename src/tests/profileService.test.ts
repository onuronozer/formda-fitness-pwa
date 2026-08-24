import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { MeasurementRepository } from '../db/repositories'
import { ProfileService } from '../services/ProfileService'
import type { OnboardingDraft } from '../stores/onboardingStore'
import { toLocalDate } from '../utils/localDate'

const names: string[] = []
const testName = () => { const name = `formda-profile-${crypto.randomUUID()}`; names.push(name); return name }

const draft: OnboardingDraft = {
  displayName: 'Deniz',
  birthDate: '1992-06-15',
  sex: 'unspecified',
  heightCm: '172',
  currentWeightKg: '78',
  targetWeightKg: '70',
  waistCm: '88',
  primaryGoal: 'weight_loss',
  experienceLevel: 'beginner',
  trainingDaysPerWeek: 3,
  trainingLocation: 'home',
  availableEquipment: ['bodyweight'],
  selectedConditions: [],
  healthAnswers: {},
}

afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('ProfileService', () => {
  it('creates the onboarding weight as the first WeightRecord', async () => {
    const db = new FormdaDatabase(testName())
    const service = new ProfileService(db)
    const { snapshot } = await service.save(draft)
    const weights = await db.weightRecords.where('userId').equals(snapshot.profile.id).toArray()

    expect(weights).toHaveLength(1)
    expect(weights[0]).toMatchObject({ valueKg: 78, source: 'manual', note: 'Başlangıç ölçümü' })
    expect(weights[0].localDate).toBe(toLocalDate(weights[0].measuredAt))
    db.close()
  })

  it('keeps WeightRecord as source of truth while editing a profile', async () => {
    const db = new FormdaDatabase(testName())
    const service = new ProfileService(db)
    const repository = new MeasurementRepository(db)
    const { snapshot } = await service.save(draft)
    const initial = (await db.weightRecords.where('userId').equals(snapshot.profile.id).first())!
    const createdAt = new Date(new Date(initial.createdAt).getTime() + 1).toISOString()
    await repository.insertWeight({
      ...createEntityMetadata(createdAt),
      userId: snapshot.profile.id,
      valueKg: 77,
      measuredAt: initial.measuredAt,
      localDate: initial.localDate,
      source: 'manual',
    })

    const existing = (await service.load(snapshot.profile.id))!
    await service.save({ ...draft, currentWeightKg: '120' }, existing)

    expect((await db.userProfiles.get(snapshot.profile.id))?.currentWeightKg).toBe(77)
    expect(await db.weightRecords.where('userId').equals(snapshot.profile.id).count()).toBe(2)
    db.close()
  })
})
