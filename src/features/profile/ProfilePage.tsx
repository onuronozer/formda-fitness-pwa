import { differenceInYears, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Dumbbell, MapPin, Pencil, Ruler, Scale, Settings, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { RiskStatus } from '../../components/RiskStatus'
import { MeasurementRepository, UserRepository } from '../../db/repositories'
import { ProfileService } from '../../services/ProfileService'
import { conditionLabels } from '../health/conditionQuestions'

const userRepository = new UserRepository()
const profileService = new ProfileService()
const measurementRepository = new MeasurementRepository()
const goalLabels = { weight_loss: 'Kilo verme', fat_loss: 'Yağ azaltma', muscle_gain: 'Kas kazanma', maintain: 'Koruma', conditioning: 'Kondisyon' }
const locationLabels = { home: 'Ev', gym: 'Spor salonu', both: 'Ev + salon' }

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useLiveQuery(() => userRepository.getActive())
  const snapshot = useLiveQuery(() => profile ? profileService.load(profile.id) : undefined, [profile?.id])
  const latestWeight = useLiveQuery(() => profile ? measurementRepository.getLatestWeight(profile.id) : undefined, [profile?.id])
  const evaluation = snapshot ? profileService.evaluate(snapshot) : undefined

  return <div className="page-content">
    <PageHeader eyebrow="KİŞİSEL PROFİL" title={profile?.displayName ?? 'Profil'} action={<div className="profile-header-actions"><button className="icon-button" aria-label="Ayarlar" onClick={() => navigate('/settings')}><Settings size={19} /></button><button className="secondary-button icon-command" onClick={() => navigate('/onboarding?edit=1')}><Pencil size={17} /> Düzenle</button></div>} />
    {evaluation && <RiskStatus status={evaluation.status} />}
    <section className="profile-section"><h2>Temel bilgiler</h2><dl className="detail-list">
      <div><Ruler size={18} /><dt>Boy</dt><dd>{profile?.heightCm} cm</dd></div>
      <div><Scale size={18} /><dt>Mevcut kilo</dt><dd>{latestWeight?.valueKg ?? profile?.currentWeightKg} kg</dd></div>
      <div><Target size={18} /><dt>Hedef</dt><dd>{profile ? goalLabels[profile.primaryGoal] : '--'} · {profile?.targetWeightKg} kg</dd></div>
      <div><CalendarDays size={18} /><dt>Yaş</dt><dd>{profile ? differenceInYears(new Date(), parseISO(profile.birthDate)) : '--'}</dd></div>
    </dl></section>
    <section className="profile-section"><h2>Antrenman</h2><dl className="detail-list">
      <div><Dumbbell size={18} /><dt>Deneyim</dt><dd>{profile?.experienceLevel === 'beginner' ? 'Başlangıç' : profile?.experienceLevel === 'intermediate' ? 'Orta' : 'İleri'}</dd></div>
      <div><CalendarDays size={18} /><dt>Sıklık</dt><dd>Haftada {profile?.trainingDaysPerWeek} gün</dd></div>
      <div><MapPin size={18} /><dt>Konum</dt><dd>{profile ? locationLabels[profile.trainingLocation] : '--'}</dd></div>
    </dl></section>
    <section className="profile-section"><h2>Sağlık durumları</h2><div className="chip-list">{snapshot?.conditions.length ? snapshot.conditions.map((condition) => <span key={condition.id}>{conditionLabels[condition.conditionType]}</span>) : <p>Seçili durum yok.</p>}</div></section>
  </div>
}
