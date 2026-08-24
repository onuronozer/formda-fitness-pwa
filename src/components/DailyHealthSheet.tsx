import { Activity, AlertTriangle, BatteryMedium, ChevronRight, HeartPulse, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DailyHealthCheck, DailyHealthResponse, HealthCondition } from '../domain/models'
import { DailyHealthService } from '../services/DailyHealthService'
import { isInitialBloodPressureHigh } from '../config/clinicalSafety'
import { toLocalDate } from '../utils/localDate'
import { reportTechnicalError } from '../utils/technicalError'
import { useDialogFocus } from './useDialogFocus'

interface DailyHealthSheetProps {
  open: boolean
  userId: string
  conditions: HealthCondition[]
  previous?: DailyHealthCheck
  previousResponses?: DailyHealthResponse[]
  onClose: () => void
  onSaved: (result: Awaited<ReturnType<DailyHealthService['saveDailyCheck']>>) => void
}

const service = new DailyHealthService()
const boolQuestions = {
  lumbar_disc_herniation: [
    ['radiating_leg_pain', 'Bacağa yayılan ağrı'], ['new_numbness', 'Yeni uyuşma'], ['new_weakness', 'Yeni güç kaybı'],
    ['bladder_change', 'Yeni mesane değişikliği'], ['bowel_change', 'Yeni bağırsak değişikliği'],
    ['saddle_numbness', 'Eyer bölgesinde uyuşma'], ['progressive_motor_weakness', 'İlerleyen kas güçsüzlüğü'],
  ],
  hypertension: [
    ['measured_bp_today', 'Bugün tansiyon ölçüldü'],
  ],
  knee_problem: [['pain_changed', 'Diz ağrısı değişti'], ['movement_limitation', 'Hareket kısıtlılığı var']],
  shoulder_problem: [['pain_changed', 'Omuz ağrısı değişti'], ['movement_limitation', 'Hareket kısıtlılığı var']],
} as const

const hypertensionSymptoms = [
  ['dizziness', 'Baş dönmesi'], ['chest_pain', 'Göğüs ağrısı'], ['unusual_shortness_of_breath', 'Olağandışı nefes darlığı'],
  ['weakness_or_numbness', 'Güçsüzlük veya uyuşma'], ['vision_change', 'Görmede değişiklik'], ['speech_change', 'Konuşmada değişiklik'],
  ['other_acute_warning_symptom', 'Başka yeni, ciddi belirti'],
] as const

export function DailyHealthSheet({ open, userId, conditions, previous, previousResponses = [], onClose, onSaved }: DailyHealthSheetProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [pain, setPain] = useState(previous?.overallPain ?? 0)
  const [energy, setEnergy] = useState(previous?.energyLevel ?? 3)
  const [unusual, setUnusual] = useState(false)
  const [answers, setAnswers] = useState<Record<string, boolean | number>>({})
  const [repeatSystolic, setRepeatSystolic] = useState<number | ''>('')
  const [repeatDiastolic, setRepeatDiastolic] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  useDialogFocus(open, dialogRef, onClose)
  useEffect(() => {
    if (!open) return
    const previousAnswers = Object.fromEntries(previousResponses.map((response) => [
      `${response.conditionType}.${response.questionKey}`,
      response.booleanValue ?? response.numberValue ?? false,
    ]))
    setPain(previous?.overallPain ?? 0); setEnergy(previous?.energyLevel ?? 3); setUnusual(previous?.unusualSymptoms ?? false); setAnswers(previousAnswers)
    setRepeatSystolic(previous?.repeatBpRequired ? '' : previous?.repeatSystolic ?? '')
    setRepeatDiastolic(previous?.repeatBpRequired ? '' : previous?.repeatDiastolic ?? '')
    setError(undefined)
  }, [open, previous?.id, previous?.energyLevel, previous?.overallPain, previous?.repeatBpRequired, previous?.repeatDiastolic, previous?.repeatSystolic, previous?.unusualSymptoms, previousResponses])
  if (!open) return null

  const activeTypes = [...new Set(conditions.filter((condition) => condition.active).map((condition) => condition.conditionType))]
  const setAnswer = (condition: string, key: string, value: boolean | number) => setAnswers((current) => ({ ...current, [`${condition}.${key}`]: value }))
  const save = async () => {
    setSaving(true); setError(undefined)
    try {
      const responses = Object.entries(answers).map(([compound, value]) => {
        const [conditionType, questionKey] = compound.split('.')
        return { conditionType: conditionType as HealthCondition['conditionType'], questionKey, ...(typeof value === 'boolean' ? { booleanValue: value } : { numberValue: value }) }
      })
      const result = await service.saveDailyCheck(userId, {
        localDate: toLocalDate(new Date()), overallPain: pain, energyLevel: energy, unusualSymptoms: unusual, responses,
        ...(previous?.repeatBpRequired && repeatSystolic !== '' && repeatDiastolic !== '' ? { repeatSystolic, repeatDiastolic } : {}),
      })
      onSaved(result); onClose()
    } catch (cause) { reportTechnicalError('Daily health save', cause); setError(cause instanceof Error ? cause.message : 'Kontrol kaydedilemedi.') }
    finally { setSaving(false) }
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="measurement-sheet health-sheet" role="dialog" aria-modal="true" aria-labelledby="daily-health-title">
      <header><span /><h2 id="daily-health-title">Bugün nasılsın?</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header>
      <div className="health-quick-grid">
        <label><span><Activity size={17} /> Ağrı <b>{pain}</b></span><input aria-label="Ağrı düzeyi" type="range" min="0" max="10" value={pain} onChange={(event) => setPain(Number(event.target.value))} /></label>
        <label><span><BatteryMedium size={17} /> Enerji <b>{energy}</b></span><input aria-label="Enerji düzeyi" type="range" min="1" max="5" value={energy} onChange={(event) => setEnergy(Number(event.target.value))} /></label>
      </div>
      <label className="health-toggle"><span><AlertTriangle size={18} /> Yeni veya olağandışı belirti</span><input type="checkbox" checked={unusual} onChange={(event) => setUnusual(event.target.checked)} /></label>
      {activeTypes.flatMap((conditionType) => {
        const questions = boolQuestions[conditionType as keyof typeof boolQuestions]
        if (!questions) return []
        return [<fieldset className="condition-daily" key={conditionType}><legend>{conditionType === 'lumbar_disc_herniation' ? 'Bel durumu' : conditionType === 'hypertension' ? 'Tansiyon durumu' : conditionType === 'knee_problem' ? 'Diz durumu' : 'Omuz durumu'}</legend>
          {questions.map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={answers[`${conditionType}.${key}`] === true} onChange={(event) => setAnswer(conditionType, key, event.target.checked)} /></label>)}
          {(conditionType === 'knee_problem' || conditionType === 'shoulder_problem') && <label className="score-input"><span>Belirti seviyesi</span><input aria-label={`${conditionType} belirti seviyesi`} type="number" min="0" max="10" value={Number(answers[`${conditionType}.pain_score`] ?? 0)} onChange={(event) => setAnswer(conditionType, 'pain_score', Number(event.target.value))} /></label>}
          {conditionType === 'hypertension' && answers['hypertension.measured_bp_today'] === true && <div className="bp-row"><label><span>Sistolik</span><input aria-label="Sistolik" type="number" min="70" max="250" value={typeof answers['hypertension.systolic'] === 'number' ? answers['hypertension.systolic'] : ''} onChange={(event) => setAnswer('hypertension', 'systolic', Number(event.target.value))} /></label><label><span>Diyastolik</span><input aria-label="Diyastolik" type="number" min="40" max="150" value={typeof answers['hypertension.diastolic'] === 'number' ? answers['hypertension.diastolic'] : ''} onChange={(event) => setAnswer('hypertension', 'diastolic', Number(event.target.value))} /></label></div>}
          {conditionType === 'hypertension' && (unusual || previous?.repeatBpRequired || hypertensionSymptoms.some(([key]) => answers[`hypertension.${key}`] === true)) && <div className="conditional-health-fields">{hypertensionSymptoms.map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={answers[`hypertension.${key}`] === true} onChange={(event) => setAnswer('hypertension', key, event.target.checked)} /></label>)}</div>}
          {conditionType === 'hypertension' && previous?.repeatBpRequired && <div className="bp-repeat-panel" role="status"><strong>Ölçümü tekrar kontrol et</strong><span>İlk ölçümden en az 1 dakika sonra.</span><div className="bp-row"><label><span>Sistolik</span><input aria-label="Tekrar sistolik" type="number" min="70" max="250" value={repeatSystolic} onChange={(event) => setRepeatSystolic(event.target.value === '' ? '' : Number(event.target.value))} /></label><label><span>Diyastolik</span><input aria-label="Tekrar diyastolik" type="number" min="40" max="150" value={repeatDiastolic} onChange={(event) => setRepeatDiastolic(event.target.value === '' ? '' : Number(event.target.value))} /></label></div></div>}
          {conditionType === 'hypertension' && !previous?.repeatBpRequired && answers['hypertension.measured_bp_today'] === true && isInitialBloodPressureHigh(Number(answers['hypertension.systolic'] ?? 0), Number(answers['hypertension.diastolic'] ?? 0)) && <p className="bp-inline-note">Bu ölçüm kaydedildikten sonra tekrar kontrol istenecek.</p>}
        </fieldset>]
      })}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <HeartPulse size={18} />} Kaydet <ChevronRight size={18} /></button>
    </section>
  </div>
}
