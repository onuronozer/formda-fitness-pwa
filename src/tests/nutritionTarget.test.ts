import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type NutritionSettings } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { UserRepository } from '../db/repositories'
import { NutritionTargetEngine } from '../rules/nutrition'
import { NutritionTargetService } from '../services/NutritionTargetService'
import { USER_ID, validProfile } from './fixtures'

const engine = new NutritionTargetEngine()
const settings = (changes: Partial<NutritionSettings> = {}): NutritionSettings => ({ ...createEntityMetadata(), userId: USER_ID, activityLevel: 'moderate', ...changes })
const profile = { ...validProfile, sex: 'male' as const, primaryGoal: 'maintain' as const }
const names: string[] = []
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('NutritionTargetEngine', () => {
  it('rejects a missing profile and an inapplicable profile', () => {
    expect(engine.generate(undefined, settings(), '2026-08-24').errors).toContain('PROFILE_REQUIRED')
    expect(engine.generate(validProfile, settings(), '2026-08-24').errors).toContain('SEX_REQUIRED_FOR_ENERGY_EQUATION')
  })

  it('calculates a maintenance recommendation with equation audit', () => {
    const result = engine.generate(profile, settings(), '2026-08-24')
    expect(result.target?.energyKcal).toBeCloseTo(result.target!.formulaAudit!.maintenanceEnergyKcal)
    expect(result.target?.formulaAudit).toMatchObject({ equationName: 'MIFFLIN_ST_JEOR_1990', equationSourceId: 'evidence-mifflin-1990', caloriePolicy: 'MAINTENANCE' })
  })

  it('applies the configured weight-loss program policy without a hidden safety threshold', () => {
    const result = engine.generate({ ...profile, primaryGoal: 'weight_loss' }, settings(), '2026-08-24')
    expect(result.target?.energyKcal).toBeCloseTo(result.target!.formulaAudit!.maintenanceEnergyKcal * 0.9)
    expect(result.target?.formulaAudit?.caloriePolicy).toBe('PROGRAM_DEFICIT')
  })

  it('supports manual calorie and macro overrides', () => {
    const target = engine.generate(profile, settings({ manualEnergyKcal: 2200, manualProteinG: 150, manualCarbohydrateG: 250, manualFatG: 70 }), '2026-08-24').target
    expect(target).toMatchObject({ energyKcal: 2200, proteinG: 150, carbohydrateG: 250, fatG: 70, source: 'MANUAL_OVERRIDE' })
  })

  it('uses the provenance-linked resistance protein rule and program macro distribution', () => {
    const target = engine.generate(profile, settings(), '2026-08-24').target!
    expect(target.proteinG).toBe(profile.currentWeightKg * 1.6)
    expect(target.formulaAudit).toMatchObject({ proteinRuleId: 'nutrition-protein-resistance-2018', proteinRuleType: 'EVIDENCE_RULE', proteinEvidenceIds: ['evidence-morton-protein-2018'] })
    expect(target.energyKcal).toBeCloseTo(target.proteinG * 4 + target.carbohydrateG * 4 + target.fatG * 9)
  })

  it('classifies the general protein default as a PROGRAM_RULE without evidence', () => {
    const target = engine.generate({ ...profile, trainingDaysPerWeek: 1 }, settings(), '2026-08-24').target!
    expect(target.proteinG).toBe(profile.currentWeightKg * 1.2)
    expect(target.formulaAudit).toMatchObject({ proteinRuleId: 'nutrition-protein-general-v1', proteinRuleType: 'PROGRAM_RULE', proteinEvidenceIds: [] })
  })

  it('rejects an incompatible automatic macro distribution instead of silently clamping carbohydrate', () => {
    const result = engine.generate({ ...profile, currentWeightKg: 350 }, settings({ manualEnergyKcal: 500 }), '2026-08-24')
    expect(result.target).toBeUndefined()
    expect(result.errors).toContain('PROGRAM_MACRO_DISTRIBUTION_INVALID')
  })

  it('increases sodium visibility for hypertension without inventing a target', () => {
    const result = engine.generate(profile, settings(), '2026-08-24', true)
    expect(result.sodiumVisibility).toBe('ENHANCED'); expect(result.target?.sodiumMg).toBeUndefined(); expect(result.warnings).toContain('SODIUM_VISIBLE_WITHOUT_AUTOMATIC_TARGET')
  })

  it('keeps an existing daily target immutable', async () => {
    const name = `formda-nutrition-target-${crypto.randomUUID()}`; names.push(name); const db = new FormdaDatabase(name)
    await new UserRepository(db).save(profile); const service = new NutritionTargetService(db)
    const first = await service.getOrCreate(USER_ID, '2026-08-24'); await service.updateSettings(USER_ID, { manualEnergyKcal: 1800 })
    const second = await service.getOrCreate(USER_ID, '2026-08-24')
    expect(second).toEqual(first); expect(second?.version).toBe(1); db.close()
  })
})
