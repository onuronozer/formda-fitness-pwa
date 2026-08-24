import { CalendarDays, Dumbbell, MapPin, Scale } from 'lucide-react'
import type { HealthRiskResult } from '../../../rules/health'
import type { OnboardingDraft } from '../../../stores/onboardingStore'
import { RiskStatus } from '../../../components/RiskStatus'
import { conditionLabels } from '../../health/conditionQuestions'

const goalLabels = { weight_loss: 'Kilo verme', fat_loss: 'Yağ azaltma', muscle_gain: 'Kas kazanma', maintain: 'Koruma', conditioning: 'Kondisyon' }
const locationLabels = { home: 'Ev', gym: 'Spor salonu', both: 'Ev + salon' }

export function SummaryStep({ draft, evaluation }: { draft: OnboardingDraft; evaluation: HealthRiskResult }) {
  return <><div className="step-heading"><span>ÖZET</span><h1>Başlamaya hazırsın.</h1><p>Bilgilerini ve program güvenlik durumunu kontrol et.</p></div>
    <RiskStatus status={evaluation.status} />
    <dl className="summary-grid">
      <div><Scale size={18} /><dt>Hedef</dt><dd>{goalLabels[draft.primaryGoal]}</dd></div>
      <div><Dumbbell size={18} /><dt>Seviye</dt><dd>{draft.experienceLevel === 'beginner' ? 'Başlangıç' : draft.experienceLevel === 'intermediate' ? 'Orta' : 'İleri'}</dd></div>
      <div><CalendarDays size={18} /><dt>Ritim</dt><dd>Haftada {draft.trainingDaysPerWeek} gün</dd></div>
      <div><MapPin size={18} /><dt>Konum</dt><dd>{locationLabels[draft.trainingLocation]}</dd></div>
    </dl>
    <section className="summary-conditions"><h2>Sağlık profili</h2><p>{draft.selectedConditions.length ? draft.selectedConditions.map((condition) => conditionLabels[condition]).join(', ') : 'Seçili durum yok'}</p></section>
  </>
}
