import { differenceInYears, parseISO } from 'date-fns'
import { createEntityMetadata, type DailyNutritionTarget, type NutritionSettings, type UserProfile } from '../../domain/models'
import { NUTRITION_PROGRAM_CONFIG, NUTRITION_RULE_PROVENANCE, NUTRITION_TARGET_RULE_VERSION } from '../../config/nutrition'

export interface NutritionTargetResult { target?: DailyNutritionTarget; errors: string[]; warnings: string[]; sodiumVisibility: 'STANDARD' | 'ENHANCED' }

export class NutritionTargetEngine {
  generate(profile: UserProfile | undefined, settings: NutritionSettings, localDate: string, hasHypertension = false): NutritionTargetResult {
    if (!profile) return { errors: ['PROFILE_REQUIRED'], warnings: [], sodiumVisibility: hasHypertension ? 'ENHANCED' : 'STANDARD' }
    if (profile.sex === 'unspecified') return { errors: ['SEX_REQUIRED_FOR_ENERGY_EQUATION'], warnings: [], sodiumVisibility: hasHypertension ? 'ENHANCED' : 'STANDARD' }
    const ageYears = differenceInYears(parseISO(localDate), parseISO(profile.birthDate))
    if (ageYears < 18) return { errors: ['ADULT_EQUATION_NOT_APPLICABLE'], warnings: [], sodiumVisibility: hasHypertension ? 'ENHANCED' : 'STANDARD' }

    const sexConstant = profile.sex === 'male' ? 5 : -161
    const restingEnergyKcal = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * ageYears + sexConstant
    const activityMultiplier = NUTRITION_PROGRAM_CONFIG.activityMultipliers[settings.activityLevel]
    const maintenanceEnergyKcal = restingEnergyKcal * activityMultiplier
    const programEnergy = ['weight_loss', 'fat_loss'].includes(profile.primaryGoal) ? maintenanceEnergyKcal * (1 - NUTRITION_PROGRAM_CONFIG.weightLossDeficitFraction) : maintenanceEnergyKcal
    const energyKcal = settings.manualEnergyKcal ?? programEnergy
    const proteinG = settings.manualProteinG ?? profile.currentWeightKg * (profile.trainingDaysPerWeek >= 2 ? NUTRITION_PROGRAM_CONFIG.resistanceTrainingProteinGPerKg : NUTRITION_PROGRAM_CONFIG.generalProteinGPerKg)
    const fatG = settings.manualFatG ?? energyKcal * NUTRITION_PROGRAM_CONFIG.fatEnergyFraction / 9
    const carbohydrateG = settings.manualCarbohydrateG ?? Math.max(1, (energyKcal - proteinG * 4 - fatG * 9) / 4)
    const manual = [settings.manualEnergyKcal, settings.manualProteinG, settings.manualCarbohydrateG, settings.manualFatG, settings.manualFiberG, settings.manualSodiumMg].some((value) => value !== undefined)
    const target: DailyNutritionTarget = {
      ...createEntityMetadata(new Date().toISOString()), userId: profile.id, localDate, energyKcal, proteinG, carbohydrateG, fatG,
      fiberG: settings.manualFiberG, sodiumMg: settings.manualSodiumMg, source: manual ? 'MANUAL_OVERRIDE' : 'RECOMMENDATION', ruleVersion: NUTRITION_TARGET_RULE_VERSION,
      formulaAudit: {
        equationName: 'MIFFLIN_ST_JEOR_1990', equationVersion: 1, equationSourceId: NUTRITION_RULE_PROVENANCE.energyEquation.evidenceIds[0],
        inputs: { weightKg: profile.currentWeightKg, heightCm: profile.heightCm, ageYears, sex: profile.sex, activityLevel: settings.activityLevel },
        restingEnergyKcal, activityMultiplier, maintenanceEnergyKcal,
        caloriePolicy: settings.manualEnergyKcal ? 'MANUAL_OVERRIDE' : ['weight_loss', 'fat_loss'].includes(profile.primaryGoal) ? 'PROGRAM_DEFICIT' : 'MAINTENANCE',
        proteinRuleId: NUTRITION_RULE_PROVENANCE.proteinResistance.id, programRuleVersion: NUTRITION_TARGET_RULE_VERSION,
      },
    }
    return { target, errors: [], warnings: hasHypertension && settings.manualSodiumMg === undefined ? ['SODIUM_VISIBLE_WITHOUT_AUTOMATIC_TARGET'] : [], sodiumVisibility: hasHypertension ? 'ENHANCED' : 'STANDARD' }
  }
}
