import type { ConditionAnswer, HealthCondition, UserProfile } from '../domain/models'

export const NOW = '2026-08-24T08:00:00.000Z'
export const USER_ID = '11111111-1111-4111-8111-111111111111'
export const HEALTH_PROFILE_ID = '22222222-2222-4222-8222-222222222222'

const metadata = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW, version: 1, schemaVersion: 3 })

export const validProfile: UserProfile = {
  ...metadata(USER_ID),
  displayName: 'Deniz',
  birthDate: '1992-06-15',
  sex: 'unspecified',
  heightCm: 172,
  currentWeightKg: 78,
  targetWeightKg: 70,
  waistCm: 88,
  primaryGoal: 'weight_loss',
  experienceLevel: 'beginner',
  trainingDaysPerWeek: 3,
  trainingLocation: 'home',
  availableEquipment: ['bodyweight'],
}

export function condition(type: HealthCondition['conditionType'], id = '33333333-3333-4333-8333-333333333333'): HealthCondition {
  return { ...metadata(id), userId: USER_ID, healthProfileId: HEALTH_PROFILE_ID, conditionType: type, active: true }
}

export function answer(conditionId: string, questionKey: string, value: boolean | number): ConditionAnswer {
  return {
    ...metadata(crypto.randomUUID()),
    userId: USER_ID,
    conditionId,
    questionKey,
    ...(typeof value === 'boolean' ? { booleanValue: value } : { numberValue: value }),
  }
}
