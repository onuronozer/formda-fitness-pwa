import type { OnboardingDraft } from '../../../stores/onboardingStore'
import { ChoiceGrid, Field } from '../components/FormControls'

export function BasicInfoStep({ draft, update }: { draft: OnboardingDraft; update: (values: Partial<OnboardingDraft>) => void }) {
  return <><div className="step-heading"><span>HAKKINDA</span><h1>Seni biraz tanıyalım.</h1><p>Temel bilgilerin plan hesaplamalarında kullanılacak.</p></div><div className="form-stack">
    <Field label="Adın"><input autoFocus autoComplete="name" value={draft.displayName} onChange={(event) => update({ displayName: event.target.value })} placeholder="Adın" /></Field>
    <div className="form-row"><Field label="Doğum tarihi"><input type="date" value={draft.birthDate} onChange={(event) => update({ birthDate: event.target.value })} /></Field><Field label="Boy"><div className="unit-input"><input inputMode="decimal" value={draft.heightCm} onChange={(event) => update({ heightCm: event.target.value })} placeholder="172" /><span>cm</span></div></Field></div>
    <ChoiceGrid label="Cinsiyet" value={draft.sex} onChange={(sex) => update({ sex })} columns={3} options={[{ value: 'female', label: 'Kadın' }, { value: 'male', label: 'Erkek' }, { value: 'unspecified', label: 'Belirtme' }]} />
  </div></>
}
