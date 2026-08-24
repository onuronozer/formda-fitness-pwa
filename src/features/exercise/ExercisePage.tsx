import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarDays, Dumbbell, Info, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ExerciseInfoSheet } from '../../components/ExerciseInfoSheet'
import { PageHeader } from '../../components/PageHeader'
import { RiskStatus } from '../../components/RiskStatus'
import type { Exercise } from '../../domain/models'
import { MOVEMENT_PATTERNS, type MovementPattern } from '../../domain/enums'
import { ExerciseRepository, UserRepository } from '../../db/repositories'
import { ProfileService } from '../../services/ProfileService'
import { WorkoutService } from '../../services/WorkoutService'
import { reportTechnicalError } from '../../utils/technicalError'

const exerciseRepository = new ExerciseRepository()
const userRepository = new UserRepository()
const profileService = new ProfileService()
const workoutService = new WorkoutService()
type View = 'program' | 'library'

const movementLabels: Record<MovementPattern, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge', horizontal_push: 'Yatay itiş', vertical_push: 'Dikey itiş',
  horizontal_pull: 'Yatay çekiş', vertical_pull: 'Dikey çekiş', elbow_flexion: 'Biceps', elbow_extension: 'Triceps',
  shoulder_abduction: 'Omuz açış', hip_extension: 'Kalça ekstansiyonu', calf_raise: 'Calf raise', core_anti_extension: 'Core anti-extension',
  core_anti_rotation: 'Core anti-rotation', locomotion: 'Yürüyüş', cardio: 'Kardiyo',
}

export function ExercisePage() {
  const [view, setView] = useState<View>('program')
  const [query, setQuery] = useState('')
  const [muscleId, setMuscleId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [movementPattern, setMovementPattern] = useState<MovementPattern | ''>('')
  const [selected, setSelected] = useState<Exercise>()
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string>()
  const profile = useLiveQuery(() => userRepository.getActive())
  const snapshot = useLiveQuery(() => profile ? profileService.load(profile.id) : undefined, [profile?.id])
  const plan = useLiveQuery(() => profile ? workoutService.getPlanOverview(profile.id) : undefined, [profile?.id])
  const muscles = useLiveQuery(() => exerciseRepository.listMuscles(), [], [])
  const equipment = useLiveQuery(() => exerciseRepository.listEquipment(), [], [])
  const exercises = useLiveQuery(() => exerciseRepository.list({ query, muscleId, equipmentId, movementPattern }), [query, muscleId, equipmentId, movementPattern], [])
  const evaluation = snapshot ? profileService.evaluate(snapshot) : undefined

  const generate = async () => {
    if (!profile || !evaluation) return
    setGenerating(true); setMessage(undefined)
    try {
      const result = await workoutService.generatePlan(profile.id, { ...evaluation, triggeredRuleIds: evaluation.triggeredRules })
      if (!result.generated.allowed) setMessage(result.generated.reason === 'red_flag' ? 'Bugünkü antrenman başlatılamıyor.' : result.generated.reason === 'medical_review' ? 'Bugünkü plan için değerlendirme gerekli.' : result.generated.reason === 'unsupported_training_days' ? 'Program için 2, 3 veya 4 gün seç.' : 'Program doğrulanamadı.')
      else setMessage('Programın oluşturuldu.')
    } catch (error) { reportTechnicalError('Workout generate', error); setMessage('Program oluşturulamadı.') }
    finally { setGenerating(false) }
  }

  const muscleNames = (exercise: Exercise) => muscles.filter((muscle) => exercise.primaryMuscleIds.includes(muscle.id)).map((muscle) => muscle.name).join(' · ')

  return <div className="page-content exercise-page">
    <PageHeader eyebrow="HAREKET VE PROGRAM" title="Egzersiz" />
    <div className="exercise-view-tabs" role="tablist" aria-label="Egzersiz görünümü"><button role="tab" aria-selected={view === 'program'} className={view === 'program' ? 'active' : ''} onClick={() => setView('program')}><CalendarDays size={18} /> Program</button><button role="tab" aria-selected={view === 'library'} className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><BookOpen size={18} /> Kütüphane</button></div>

    {view === 'program' ? <section className="program-view">
      {evaluation && <div className="program-health"><ShieldCheck size={18} /><span>Program durumu</span><RiskStatus status={evaluation.status} compact /></div>}
      {!plan ? <div className="program-empty"><Dumbbell size={30} /><h2>Programın hazır değil</h2><p>Profiline ve mevcut sağlık değerlendirmene göre temel bir plan oluştur.</p><button className="primary-button" onClick={generate} disabled={generating || !evaluation}><Sparkles size={18} /> {generating ? 'Oluşturuluyor' : 'Programımı Oluştur'}</button></div>
        : <div className="program-days"><header><div><span>AKTİF PROGRAM</span><h2>{plan.plan.name}</h2></div><button className="text-command" onClick={generate} disabled={generating}>Yenile</button></header>{plan.days.map(({ day, targets, exercises: dayExercises }) => <article key={day.id} className="program-day"><div><span>Gün {day.dayIndex + 1}</span><h3>{day.name}</h3></div><ul>{targets.map((target, index) => { const exercise = dayExercises[index]; return exercise && <li key={target.id}><span><strong>{exercise.name}</strong><small>{target.targetSets} × {target.targetRepMin}–{target.targetRepMax}{target.modified ? ' · uyarlanmış' : ''}</small></span><button aria-label={`${exercise.name} hareket bilgisini aç`} onClick={() => setSelected(exercise)}><Info size={18} /></button></li> })}</ul></article>)}</div>}
      {message && <p className="inline-message" role="status">{message}</p>}
    </section> : <section className="library-view">
      <label className="exercise-search"><Search size={18} /><input aria-label="Hareket ara" placeholder="Hareket ara" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="exercise-filters"><select aria-label="Kas grubu" value={muscleId} onChange={(event) => setMuscleId(event.target.value)}><option value="">Tüm kaslar</option>{muscles.map((muscle) => <option key={muscle.id} value={muscle.id}>{muscle.name}</option>)}</select><select aria-label="Ekipman" value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}><option value="">Tüm ekipman</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Hareket deseni" value={movementPattern} onChange={(event) => setMovementPattern(event.target.value as MovementPattern | '')}><option value="">Tüm desenler</option>{MOVEMENT_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{movementLabels[pattern]}</option>)}</select></div>
      <p className="library-count">{exercises.length} hareket</p>
      <div className="exercise-list">{exercises.map((exercise) => <article key={exercise.id}><div className="exercise-monogram" aria-hidden="true">{exercise.name.slice(0, 1)}</div><div><strong>{exercise.name}</strong><span>{movementLabels[exercise.movementPattern]}</span><small>{muscleNames(exercise)}</small></div><button aria-label={`${exercise.name} hareket bilgisini aç`} onClick={() => setSelected(exercise)}><Info size={19} /></button></article>)}</div>
    </section>}
    <ExerciseInfoSheet exercise={selected} open={Boolean(selected)} onClose={() => setSelected(undefined)} />
  </div>
}
