import { Activity, Dumbbell, Gauge, Scale, Sparkles } from 'lucide-react'
import type { OnboardingDraft } from '../../../stores/onboardingStore'
import { ChoiceGrid, Field } from '../components/FormControls'

export function GoalStep({ draft, update, lockCurrentWeight = false }: { draft: OnboardingDraft; update: (values: Partial<OnboardingDraft>) => void; lockCurrentWeight?: boolean }) {
  return <><div className="step-heading"><span>HEDEFİN</span><h1>Nereye ulaşmak istiyorsun?</h1><p>Planın seçtiğin hedefe göre şekillenecek.</p></div><div className="form-stack">
    <div className="form-row"><Field label={lockCurrentWeight ? 'Güncel kilo · İlerleme bölümünden değişir' : 'Mevcut kilo'}><div className="unit-input"><input autoFocus={!lockCurrentWeight} disabled={lockCurrentWeight} inputMode="decimal" value={draft.currentWeightKg} onChange={(event) => update({ currentWeightKg: event.target.value })} placeholder="78" /><span>kg</span></div></Field><Field label="Hedef kilo"><div className="unit-input"><input autoFocus={lockCurrentWeight} inputMode="decimal" value={draft.targetWeightKg} onChange={(event) => update({ targetWeightKg: event.target.value })} placeholder="70" /><span>kg</span></div></Field></div>
    <Field label="Bel çevresi" hint="İsteğe bağlı"><div className="unit-input"><input inputMode="decimal" value={draft.waistCm} onChange={(event) => update({ waistCm: event.target.value })} placeholder="88" /><span>cm</span></div></Field>
    <ChoiceGrid label="Birincil hedef" value={draft.primaryGoal} onChange={(primaryGoal) => update({ primaryGoal })} options={[{ value: 'weight_loss', label: 'Kilo vermek', icon: <Scale size={19} /> }, { value: 'fat_loss', label: 'Yağ azaltmak', icon: <Gauge size={19} /> }, { value: 'muscle_gain', label: 'Kas kazanmak', icon: <Dumbbell size={19} /> }, { value: 'maintain', label: 'Korumak', icon: <Sparkles size={19} /> }, { value: 'conditioning', label: 'Kondisyon', icon: <Activity size={19} /> }]} />
  </div></>
}
