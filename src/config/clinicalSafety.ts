export const CLINICAL_SAFETY_CONFIG = {
  version: 1,
  pain: {
    modifiedAtOrAbove: 5,
    medicalReviewAtOrAbove: 8,
    rationale: 'Conservative product safety policy; these values are not represented as medical guideline thresholds.',
  },
  bloodPressure: {
    initialHigh: { systolicAtOrAbove: 180, diastolicAtOrAbove: 120 },
    repeatHigh: { systolicAbove: 180, diastolicAbove: 120 },
    minimumRepeatDelayMs: 60_000,
  },
  acuteWarningSymptoms: [
    'chest_pain',
    'unusual_shortness_of_breath',
    'weakness_or_numbness',
    'vision_change',
    'speech_change',
    'other_acute_warning_symptom',
  ],
} as const

export function isInitialBloodPressureHigh(systolic?: number, diastolic?: number) {
  return (systolic ?? 0) >= CLINICAL_SAFETY_CONFIG.bloodPressure.initialHigh.systolicAtOrAbove
    || (diastolic ?? 0) >= CLINICAL_SAFETY_CONFIG.bloodPressure.initialHigh.diastolicAtOrAbove
}

export function isRepeatBloodPressureHigh(systolic?: number, diastolic?: number) {
  return (systolic ?? 0) > CLINICAL_SAFETY_CONFIG.bloodPressure.repeatHigh.systolicAbove
    || (diastolic ?? 0) > CLINICAL_SAFETY_CONFIG.bloodPressure.repeatHigh.diastolicAbove
}
