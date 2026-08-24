import type { ExperienceLevel, PrimaryGoal, Sex, TrainingLocation } from '../enums'
import type { EntityMetadata } from './common'

export type EquipmentType = 'bodyweight' | 'dumbbells' | 'resistance_bands' | 'machines'

export interface UserProfile extends EntityMetadata {
  displayName: string
  birthDate: string
  sex: Sex
  heightCm: number
  currentWeightKg: number
  targetWeightKg: number
  waistCm?: number
  primaryGoal: PrimaryGoal
  experienceLevel: ExperienceLevel
  trainingDaysPerWeek: number
  trainingLocation: TrainingLocation
  availableEquipment: EquipmentType[]
}
