import { describe, expect, it } from 'vitest'
import { bloodPressureSchema, userProfileInputSchema, userProfileSchema } from '../validation/profileSchemas'
import { validProfile } from './fixtures'

describe('profile validation', () => {
  it('accepts a valid profile', () => {
    expect(userProfileSchema.safeParse(validProfile).success).toBe(true)
  })

  it('rejects an implausible weight', () => {
    expect(userProfileSchema.safeParse({ ...validProfile, currentWeightKg: 12 }).success).toBe(false)
  })

  it('rejects an implausible height', () => {
    expect(userProfileSchema.safeParse({ ...validProfile, heightCm: 280 }).success).toBe(false)
  })

  it('rejects an invalid blood pressure format', () => {
    expect(bloodPressureSchema.safeParse('120-80').success).toBe(false)
    expect(bloodPressureSchema.safeParse('999/1').success).toBe(false)
  })

  it('limits new or edited profiles to 2, 3, or 4 training days', () => {
    expect(userProfileInputSchema.safeParse({ ...validProfile, trainingDaysPerWeek: 2 }).success).toBe(true)
    expect(userProfileInputSchema.safeParse({ ...validProfile, trainingDaysPerWeek: 5 }).success).toBe(false)
  })

  it('keeps legacy 5+ day profiles readable for migration compatibility', () => {
    expect(userProfileSchema.safeParse({ ...validProfile, trainingDaysPerWeek: 6 }).success).toBe(true)
  })
})
