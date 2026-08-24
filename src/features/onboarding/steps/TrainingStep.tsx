import { Building2, Dumbbell, Home } from 'lucide-react'
import type { EquipmentType } from '../../../domain/models'
import type { OnboardingDraft } from '../../../stores/onboardingStore'
import { ChoiceGrid } from '../components/FormControls'

const equipment: { value: EquipmentType; label: string }[] = [{ value: 'bodyweight', label: 'Vücut ağırlığı' }, { value: 'dumbbells', label: 'Dambıl' }, { value: 'resistance_bands', label: 'Direnç bandı' }, { value: 'machines', label: 'Makineler' }]

export function TrainingStep({ draft, update }: { draft: OnboardingDraft; update: (values: Partial<OnboardingDraft>) => void }) {
  const toggleEquipment = (value: EquipmentType) => update({ availableEquipment: draft.availableEquipment.includes(value) ? draft.availableEquipment.filter((item) => item !== value) : [...draft.availableEquipment, value] })
  const legacyUnsupportedDays = draft.trainingDaysPerWeek < 2 || draft.trainingDaysPerWeek > 4
  return <><div className="step-heading"><span>ANTRENMAN</span><h1>Ritmini ayarlayalım.</h1><p>Program günlük hayatına ve ortamına uyacak.</p></div><div className="form-stack">
    <ChoiceGrid label="Deneyim" value={draft.experienceLevel} onChange={(experienceLevel) => update({ experienceLevel })} columns={3} options={[{ value: 'beginner', label: 'Başlangıç' }, { value: 'intermediate', label: 'Orta' }, { value: 'advanced', label: 'İleri' }]} />
    <fieldset className="choice-fieldset"><legend>Haftada kaç gün?</legend><div className="day-stepper">{[2,3,4].map((day) => <button type="button" className={draft.trainingDaysPerWeek === day ? 'selected' : ''} key={day} onClick={() => update({ trainingDaysPerWeek: day })}>{day}</button>)}</div>{legacyUnsupportedDays && <p className="form-error">Mevcut gün sayın bu sürümde desteklenmiyor. 2, 3 veya 4 gün seç.</p>}</fieldset>
    <ChoiceGrid label="Nerede?" value={draft.trainingLocation} onChange={(trainingLocation) => update({ trainingLocation })} columns={3} options={[{ value: 'home', label: 'Ev', icon: <Home size={19} /> }, { value: 'gym', label: 'Salon', icon: <Building2 size={19} /> }, { value: 'both', label: 'İkisi de', icon: <Dumbbell size={19} /> }]} />
    <fieldset className="choice-fieldset"><legend>Ekipman</legend><div className="toggle-list">{equipment.map((item) => <label key={item.value}><input type="checkbox" checked={draft.availableEquipment.includes(item.value)} onChange={() => toggleEquipment(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
  </div></>
}
