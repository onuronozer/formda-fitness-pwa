import { Check, HeartPulse } from 'lucide-react'
import { HEALTH_CONDITION_TYPES } from '../../../domain/enums'
import { conditionLabels } from '../../health/conditionQuestions'
import type { OnboardingDraft } from '../../../stores/onboardingStore'

export function ConditionsStep({ draft, toggle }: { draft: OnboardingDraft; toggle: (condition: (typeof HEALTH_CONDITION_TYPES)[number]) => void }) {
  return <><div className="step-heading"><span>SAĞLIK PROFİLİ</span><h1>Programı sana göre koruyalım.</h1><p>Uygun olanları seç. Bu bilgiler cihazında kalır.</p></div><div className="condition-list" role="group" aria-label="Sağlık durumları">
    {HEALTH_CONDITION_TYPES.map((condition) => { const selected = draft.selectedConditions.includes(condition); return <button type="button" key={condition} className={selected ? 'selected' : ''} aria-pressed={selected} onClick={() => toggle(condition)}><span className="condition-icon"><HeartPulse size={18} /></span><span>{conditionLabels[condition]}</span><span className="selection-box">{selected && <Check size={16} />}</span></button> })}
  </div></>
}
