import { Info } from 'lucide-react'
import type { HealthConditionType } from '../../../domain/enums'
import type { OnboardingDraft } from '../../../stores/onboardingStore'
import { conditionLabels, conditionQuestions } from '../../health/conditionQuestions'

export function HealthQuestionsStep({ draft, setAnswer }: { draft: OnboardingDraft; setAnswer: (key: string, value: boolean | number | undefined) => void }) {
  const selectedWithQuestions = draft.selectedConditions.filter((condition) => conditionQuestions[condition]?.length)
  return <><div className="step-heading"><span>KISA KONTROL</span><h1>Birkaç ayrıntı daha.</h1><p>Tanı koymayız; yalnızca program güvenlik katmanını çalıştırırız.</p></div>
    {selectedWithQuestions.length === 0 ? <div className="empty-state"><Info size={22} /><strong>Ek soru gerekmiyor</strong><p>Seçimlerin özet adımında değerlendirilecek.</p></div> : <div className="question-groups">{selectedWithQuestions.map((condition) => <QuestionGroup key={condition} condition={condition} draft={draft} setAnswer={setAnswer} />)}</div>}
  </>
}

function QuestionGroup({ condition, draft, setAnswer }: { condition: HealthConditionType; draft: OnboardingDraft; setAnswer: (key: string, value: boolean | number | undefined) => void }) {
  return <section className="question-group"><h2>{conditionLabels[condition]}</h2>{conditionQuestions[condition]?.map((question) => { const key = `${condition}.${question.key}`; const value = draft.healthAnswers[key]; return <div className={`question-row ${question.emphasis === 'caution' ? 'caution' : ''}`} key={question.key}><label htmlFor={question.type === 'number' ? key : undefined}>{question.label}</label>{question.type === 'boolean' ? <div className="yes-no" role="radiogroup" aria-label={question.label}><button type="button" role="radio" aria-checked={value === false} className={value === false ? 'selected' : ''} onClick={() => setAnswer(key, false)}>Hayır</button><button type="button" role="radio" aria-checked={value === true} className={value === true ? 'selected' : ''} onClick={() => setAnswer(key, true)}>Evet</button></div> : <div className="compact-unit-input"><input id={key} type="number" min={question.min} max={question.max} value={typeof value === 'number' ? value : ''} onChange={(event) => setAnswer(key, event.target.value === '' ? undefined : Number(event.target.value))} /><span>{question.unit}</span></div>}</div> })}</section>
}
