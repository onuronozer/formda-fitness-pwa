import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, Check, CheckCircle2, ChevronRight, Dumbbell, Flame, Footprints, HeartPulse, Play, Plus, Ruler, Scale } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DailyHealthSheet } from '../../components/DailyHealthSheet'
import { MeasurementSheet } from '../../components/MeasurementSheet'
import { PageHeader } from '../../components/PageHeader'
import { PreWorkoutSheet } from '../../components/PreWorkoutSheet'
import { RiskStatus } from '../../components/RiskStatus'
import { WaterCard } from '../../components/WaterCard'
import { UserRepository } from '../../db/repositories'
import { DailyHealthService } from '../../services/DailyHealthService'
import { DailyGoalService } from '../../services/DailyGoalService'
import { MeasurementDashboardService } from '../../services/MeasurementDashboardService'
import { ProfileService } from '../../services/ProfileService'
import { WorkoutService } from '../../services/WorkoutService'
import { toLocalDate } from '../../utils/localDate'
import { reportTechnicalError } from '../../utils/technicalError'

const userRepository = new UserRepository()
const profileService = new ProfileService()
const dashboardService = new MeasurementDashboardService()
const dailyHealthService = new DailyHealthService()
const workoutService = new WorkoutService()
const dailyGoalService = new DailyGoalService()

function signed(value: number | undefined, unit: string) {
  if (value === undefined) return 'Henüz yok'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(1)} ${unit}`
}

export function TodayPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [preWorkoutOpen, setPreWorkoutOpen] = useState(false)
  const [startRequested, setStartRequested] = useState(false)
  const [startError, setStartError] = useState<string>()
  const profile = useLiveQuery(() => userRepository.getActive())
  const snapshot = useLiveQuery(() => profile ? profileService.load(profile.id) : undefined, [profile?.id])
  const today = toLocalDate(new Date())
  const summary = useLiveQuery(() => profile ? dashboardService.getTodaySummary(profile.id, profile.targetWeightKg, today) : undefined, [profile?.id, profile?.targetWeightKg, today], null)
  const daily = useLiveQuery(() => profile ? dailyHealthService.getLatest(profile.id, today) : undefined, [profile?.id, today])
  const workout = useLiveQuery(() => profile ? workoutService.getTodayView(profile.id, today) : undefined, [profile?.id, today])
  const evaluation = daily?.evaluation ?? (snapshot ? profileService.evaluate(snapshot) : undefined)
  const dailyGoal = useLiveQuery(() => profile ? dailyGoalService.getPlan(profile.id, today) : undefined, [profile?.id, today])
  const goalRequest = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!profile || !evaluation) return
    const key = `${profile.id}:${today}:${evaluation.status}:${workout?.day?.id ?? 'rest'}`
    if (goalRequest.current === key) return
    goalRequest.current = key
    void dailyGoalService.getOrCreate(profile.id, today, evaluation.status, workout?.day?.id).catch(() => { goalRequest.current = undefined })
  }, [evaluation, profile, today, workout?.day?.id])
  const firstName = profile?.displayName.split(' ')[0] ?? ''
  const shortcutMessage = (location.state as { shortcutMessage?: string } | null)?.shortcutMessage

  const requestStart = () => {
    setStartError(undefined)
    if (!profile || !workout?.day) { navigate('/exercise'); return }
    if (workout.session?.status === 'in_progress') { navigate(`/workout/session/${workout.session.id}`); return }
    if (!daily) { setStartRequested(true); setHealthOpen(true); return }
    if (evaluation?.status === 'RED_FLAG_BLOCKED') { setStartError('Bugünkü antrenman başlatılamıyor.'); return }
    if (evaluation?.status === 'MEDICAL_REVIEW_REQUIRED') {
      setStartError(evaluation.attentionLevel === 'REPEAT_MEASUREMENT' ? 'Ölçümü tekrar kontrol et.' : evaluation.attentionLevel === 'URGENT' ? 'Acil değerlendirme gerekli.' : 'Sağlık değerlendirmesi gerekli.')
      return
    }
    setPreWorkoutOpen(true)
  }

  const unchanged = async () => {
    if (!profile || !daily || !workout?.day) return
    try {
      const result = await dailyHealthService.createPreWorkout(profile.id, { localDate: today, dailyHealthCheckId: daily.check.id, conditionChangedSinceDailyCheck: false, newSymptoms: false })
      setPreWorkoutOpen(false)
      if (result.evaluation.status === 'RED_FLAG_BLOCKED') { setStartError('Bugünkü antrenman başlatılamıyor.'); return }
      if (result.evaluation.status === 'MEDICAL_REVIEW_REQUIRED') { setStartError(result.evaluation.attentionLevel === 'URGENT' ? 'Acil değerlendirme gerekli.' : 'Sağlık değerlendirmesi gerekli.'); return }
      const session = await workoutService.startSession(profile.id, workout.day.id, today, result.log.id, result.check.id)
      navigate(`/workout/session/${session.id}`)
    } catch (error) { reportTechnicalError('Workout start', error); setStartError('Antrenman başlatılamadı.') }
  }

  return <div className="page-content today-page">
    <PageHeader eyebrow={format(new Date(), 'd MMMM, EEEE', { locale: tr })} title={`Bugün iyi bir gün, ${firstName}.`} action={<button className="quick-add-header" aria-label="Hızlı Ekle" onClick={() => setQuickAddOpen(true)}><Plus size={23} /></button>} />
    <button className="quick-add-button" onClick={() => setQuickAddOpen(true)}><span><Plus size={22} /></span><strong>Hızlı Ekle</strong><small>Kilo · Bel · Adım</small></button>
    {shortcutMessage && <p className="shortcut-result" role="status">{shortcutMessage}</p>}

    <section className={`daily-status-card ${daily ? 'checked' : ''}`}><div className="daily-status-icon">{daily ? <CheckCircle2 size={21} /> : <HeartPulse size={21} />}</div><div><span>BUGÜNKÜ DURUM</span><strong>{daily?.check.repeatBpRequired ? 'Ölçümü tekrar kontrol et' : daily ? 'Kontrol edildi' : 'Kısa kontrolünü tamamla'}</strong>{daily && <small>Ağrı {daily.check.overallPain}/10 · Enerji {daily.check.energyLevel}/5</small>}</div><button onClick={() => setHealthOpen(true)}>{daily?.check.repeatBpRequired ? 'Tekrar ölç' : daily ? 'Durumum değişti' : 'Kontrol et'} <ChevronRight size={17} /></button></section>

    {profile && <WaterCard userId={profile.id} localDate={today} targetMl={dailyGoal?.hydrationTargetMl} />}

    <section className="today-workout-card"><header><span>BUGÜNKÜ ANTRENMAN</span>{evaluation && <RiskStatus status={evaluation.status} compact />}</header>{!workout?.plan ? <div><Dumbbell size={27} /><h2>Programını oluştur</h2><p>Temel haftalık planın henüz yok.</p><button className="primary-button" onClick={() => navigate('/exercise')}>Programımı Oluştur</button></div> : !workout.day ? <div><Check size={27} /><h2>Dinlenme günü</h2><p>Bir sonraki antrenman gününe hazırlan.</p></div> : <div><Dumbbell size={27} /><h2>{workout.day.name}</h2><p>{workout.exercises.length} hareket · ~{Math.max(20, workout.exercises.length * 7)} dk</p><button className="primary-button" onClick={requestStart} disabled={workout.session?.status === 'completed'}>{workout.session?.status === 'completed' ? 'Tamamlandı' : workout.session?.status === 'in_progress' ? 'Devam Et' : 'Antrenmanı Başlat'} <ChevronRight size={18} /></button></div>}{startError && <p className="workout-block-message" role="alert">{startError}</p>}</section>

    {dailyGoal?.cardioTarget === 'interval' && dailyGoal.intervalProtocolId && <section className="today-interval-card"><div><span>YÜRÜYÜŞ INTERVAL</span><strong>28 dk</strong><small>5 dk ısınma · 1 dk tempolu / 2 dk rahat ×6</small></div><button aria-label="Yürüyüş intervalini başlat" onClick={() => navigate(`/interval/${dailyGoal.intervalProtocolId}`)}><Play size={20} /></button></section>}

    <section className="today-weight-panel">
      <div className="today-metric-heading"><span className="metric-icon weight"><Scale size={20} /></span><div><span>Kilo</span><small>Son ölçüm</small></div></div>
      <div className="today-weight-value"><strong>{summary?.weight.latestWeight?.toFixed(1) ?? '--'}</strong><span>kg</span><small>{signed(summary?.weight.changeFromStart, 'kg')}</small></div>
      <div className="goal-progress"><div><span>Başlangıç {summary?.weight.startingWeight?.toFixed(1) ?? '--'}</span><span>Hedef {profile?.targetWeightKg.toFixed(1) ?? '--'}</span></div><div className="goal-track"><span style={{ width: `${(summary?.weight.goalProgress ?? 0) * 100}%` }} /></div></div>
    </section>
    <section className="today-secondary-grid" aria-label="Günlük ölçümler"><article><span className="metric-icon steps"><Footprints size={20} /></span><p>Adım</p><strong>{summary?.steps.todaySteps?.toLocaleString('tr-TR') ?? '--'}</strong><small>{(dailyGoal?.stepTarget ?? summary?.steps.target)?.toLocaleString('tr-TR')} hedef{dailyGoal?.reasons.includes('STEP_MANUAL_OVERRIDE') ? ' · manuel' : ' · bu hafta'}</small></article><article><span className="metric-icon waist"><Ruler size={20} /></span><p>Bel</p><strong>{summary?.waist.latest?.toFixed(1) ?? '--'}<b>{summary?.waist.latest !== undefined ? ' cm' : ''}</b></strong><small>{signed(summary?.waist.change, 'cm')}</small></article></section>
    <section className="placeholder-metrics" aria-label="Yaklaşan takip alanları"><article><Activity size={18} /><div><span>Antrenman</span><strong>{workout?.day ? workout.day.name : workout?.plan ? 'Dinlenme' : 'Program yok'}</strong></div><small>Phase 3A</small></article><article><Flame size={18} /><div><span>Kalori</span><strong>--</strong></div><small>Phase 4</small></article></section>

    <MeasurementSheet open={quickAddOpen} userId={profile?.id ?? ''} onClose={() => setQuickAddOpen(false)} />
    <DailyHealthSheet open={healthOpen} userId={profile?.id ?? ''} conditions={snapshot?.conditions ?? []} previous={daily?.check} previousResponses={daily?.responses} onClose={() => setHealthOpen(false)} onSaved={(result) => {
      if (!startRequested) return
      setStartRequested(false)
      if (result.evaluation.status === 'RED_FLAG_BLOCKED') { setStartError('Bugünkü plan başlatılamıyor.'); return }
      if (result.evaluation.status === 'MEDICAL_REVIEW_REQUIRED') {
        setStartError(result.evaluation.attentionLevel === 'REPEAT_MEASUREMENT' ? 'Ölçümü tekrar kontrol et.' : result.evaluation.attentionLevel === 'URGENT' ? 'Acil değerlendirme gerekli.' : 'Sağlık değerlendirmesi gerekli.')
        return
      }
      window.setTimeout(() => setPreWorkoutOpen(true), 0)
    }} />
    <PreWorkoutSheet open={preWorkoutOpen} onClose={() => setPreWorkoutOpen(false)} onUnchanged={unchanged} onChanged={() => { setPreWorkoutOpen(false); setStartRequested(true); setHealthOpen(true) }} />
  </div>
}
