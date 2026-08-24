import type { HealthConditionType } from '../../domain/enums'

export interface ConditionQuestionDefinition {
  key: string
  label: string
  type: 'boolean' | 'number'
  unit?: string
  min?: number
  max?: number
  emphasis?: 'standard' | 'caution'
}

export const conditionLabels: Record<HealthConditionType, string> = {
  hypertension: 'Hipertansiyon',
  lumbar_disc_herniation: 'Bel fıtığı',
  diabetes: 'Diyabet',
  knee_problem: 'Diz problemi',
  shoulder_problem: 'Omuz problemi',
  cardiovascular_condition: 'Kalp-damar rahatsızlığı',
  other: 'Diğer',
}

export const conditionQuestions: Partial<Record<HealthConditionType, ConditionQuestionDefinition[]>> = {
  hypertension: [
    { key: 'medication_use', label: 'Tansiyon ilacı kullanıyor musun?', type: 'boolean' },
    { key: 'home_bp_monitoring', label: 'Evde tansiyon takibi yapıyor musun?', type: 'boolean' },
    { key: 'last_systolic', label: 'Son sistolik değer', type: 'number', unit: 'mmHg', min: 70, max: 250 },
    { key: 'last_diastolic', label: 'Son diyastolik değer', type: 'number', unit: 'mmHg', min: 40, max: 150 },
    { key: 'exercise_dizziness', label: 'Egzersizde baş dönmesi oluyor mu?', type: 'boolean', emphasis: 'caution' },
    { key: 'exercise_chest_pain', label: 'Egzersizde göğüs ağrısı oluyor mu?', type: 'boolean', emphasis: 'caution' },
  ],
  lumbar_disc_herniation: [
    { key: 'radiating_leg_pain', label: 'Bacağa yayılan ağrı var mı?', type: 'boolean' },
    { key: 'numbness', label: 'Uyuşma var mı?', type: 'boolean' },
    { key: 'weakness', label: 'Güç kaybı var mı?', type: 'boolean' },
    { key: 'acute_flare', label: 'Şu anda akut alevlenme var mı?', type: 'boolean' },
    { key: 'professional_restriction', label: 'Bir profesyonel egzersiz kısıtlaması verdi mi?', type: 'boolean' },
    { key: 'new_bladder_dysfunction', label: 'Yeni başlayan mesane kontrol sorunu var mı?', type: 'boolean', emphasis: 'caution' },
    { key: 'new_bowel_dysfunction', label: 'Yeni başlayan bağırsak kontrol sorunu var mı?', type: 'boolean', emphasis: 'caution' },
    { key: 'saddle_numbness', label: 'Eyer bölgesinde uyuşma var mı?', type: 'boolean', emphasis: 'caution' },
    { key: 'progressive_motor_weakness', label: 'İlerleyen kas güçsüzlüğü var mı?', type: 'boolean', emphasis: 'caution' },
  ],
}
