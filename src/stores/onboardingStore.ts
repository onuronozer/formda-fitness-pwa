import { create } from 'zustand'
import type { EquipmentType } from '../domain/models'
import type { ExperienceLevel, HealthConditionType, PrimaryGoal, Sex, TrainingLocation } from '../domain/enums'

export interface OnboardingDraft {
  displayName: string
  birthDate: string
  sex: Sex
  heightCm: string
  currentWeightKg: string
  targetWeightKg: string
  waistCm: string
  primaryGoal: PrimaryGoal
  experienceLevel: ExperienceLevel
  trainingDaysPerWeek: number
  trainingLocation: TrainingLocation
  availableEquipment: EquipmentType[]
  selectedConditions: HealthConditionType[]
  healthAnswers: Record<string, boolean | number | undefined>
}

export const initialOnboardingDraft: OnboardingDraft = {
  displayName: '', birthDate: '', sex: 'unspecified', heightCm: '', currentWeightKg: '', targetWeightKg: '', waistCm: '',
  primaryGoal: 'weight_loss', experienceLevel: 'beginner', trainingDaysPerWeek: 3, trainingLocation: 'home',
  availableEquipment: ['bodyweight'], selectedConditions: [], healthAnswers: {},
}

interface OnboardingStore {
  step: number
  draft: OnboardingDraft
  editingUserId?: string
  setStep: (step: number) => void
  updateDraft: (values: Partial<OnboardingDraft>) => void
  setHealthAnswer: (key: string, value: boolean | number | undefined) => void
  toggleCondition: (condition: HealthConditionType) => void
  hydrate: (draft: OnboardingDraft, userId: string) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  step: 1,
  draft: initialOnboardingDraft,
  setStep: (step) => set({ step }),
  updateDraft: (values) => set((state) => ({ draft: { ...state.draft, ...values } })),
  setHealthAnswer: (key, value) => set((state) => ({ draft: { ...state.draft, healthAnswers: { ...state.draft.healthAnswers, [key]: value } } })),
  toggleCondition: (condition) => set((state) => {
    const selected = state.draft.selectedConditions.includes(condition)
      ? state.draft.selectedConditions.filter((item) => item !== condition)
      : [...state.draft.selectedConditions, condition]
    return { draft: { ...state.draft, selectedConditions: selected } }
  }),
  hydrate: (draft, editingUserId) => set({ draft, editingUserId, step: 1 }),
  reset: () => set({ draft: initialOnboardingDraft, editingUserId: undefined, step: 1 }),
}))
