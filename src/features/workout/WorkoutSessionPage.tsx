import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, Clock3, Info, Pause, Play, RotateCcw, Square, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExerciseInfoSheet } from '../../components/ExerciseInfoSheet'
import { PageHeader } from '../../components/PageHeader'
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../domain/models'
import type { PainLevel } from '../../domain/enums'
import { evaluateProgression } from '../../services/ProgressionService'
import { WorkoutService } from '../../services/WorkoutService'

const service = new WorkoutService()

function RestTimer({ initialSeconds, token, enabled }: { initialSeconds: number; token: number; enabled: boolean }) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  useEffect(() => { if (token > 0) { setRemaining(initialSeconds); setRunning(true) } }, [initialSeconds, token])
  useEffect(() => { if (!enabled) setRunning(false) }, [enabled])
  useEffect(() => { if (!running || remaining <= 0) return; const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer) }, [running, remaining])
  useEffect(() => { if (remaining === 0) setRunning(false) }, [remaining])
  const minutes = Math.floor(remaining / 60); const seconds = remaining % 60
  return <div className="rest-timer" aria-live="polite"><Clock3 size={18} /><span>Dinlenme</span><strong>{minutes}:{String(seconds).padStart(2, '0')}</strong><button aria-label={running ? 'Zamanlayıcıyı duraklat' : 'Zamanlayıcıyı başlat'} disabled={!enabled} onClick={() => setRunning((value) => !value)}>{running ? <Pause size={18} /> : <Play size={18} />}</button><button aria-label="Zamanlayıcıyı sıfırla" disabled={!enabled} onClick={() => { setRemaining(initialSeconds); setRunning(false) }}><RotateCcw size={17} /></button></div>
}

function SetRow({ sessionId, exerciseId, setNumber, existing, readOnly, onCompleted, onSeverePain }: { sessionId: string; exerciseId: string; setNumber: number; existing?: WorkoutSet; readOnly: boolean; onCompleted: () => void; onSeverePain: () => void }) {
  const [weight, setWeight] = useState(existing?.weightKg?.toString() ?? '')
  const [reps, setReps] = useState(existing?.reps?.toString() ?? '')
  const [rpe, setRpe] = useState(existing?.rpe?.toString() ?? '')
  const [pain, setPain] = useState<PainLevel>(existing?.painDuringSet ?? 'none')
  const [area, setArea] = useState(existing?.painBodyArea ?? '')
  const [completed, setCompleted] = useState(existing?.completed ?? false)
  const save = async (nextCompleted = completed) => {
    if (readOnly) return
    await service.saveSet({ workoutSessionId: sessionId, exerciseId, setNumber, weightKg: weight === '' ? undefined : Number(weight), reps: reps === '' ? undefined : Number(reps), rpe: rpe === '' ? undefined : Number(rpe), completed: nextCompleted, painDuringSet: pain, painBodyArea: area || undefined })
  }
  const toggle = async () => { const next = !completed; setCompleted(next); await save(next); if (next) onCompleted(); if (next && pain === 'severe') onSeverePain() }
  return <div className={`workout-set-row ${completed ? 'done' : ''}`}><span>Set {setNumber}</span><label><span>kg</span><input aria-label={`Set ${setNumber} kilo`} inputMode="decimal" type="number" min="0" step="0.5" value={weight} disabled={readOnly} onChange={(event) => setWeight(event.target.value)} onBlur={() => save()} /></label><label><span>tekrar</span><input aria-label={`Set ${setNumber} tekrar`} inputMode="numeric" type="number" min="0" value={reps} disabled={readOnly} onChange={(event) => setReps(event.target.value)} onBlur={() => save()} /></label><label><span>RPE</span><input aria-label={`Set ${setNumber} RPE`} inputMode="numeric" type="number" min="1" max="10" value={rpe} disabled={readOnly} onChange={(event) => setRpe(event.target.value)} onBlur={() => save()} /></label><button className="set-check" aria-label={`Set ${setNumber} ${completed ? 'tamamlandı' : 'tamamla'}`} aria-pressed={completed} disabled={readOnly} onClick={toggle}>{completed ? <Check size={19} /> : <span />}</button><div className="set-pain"><select aria-label={`Set ${setNumber} ağrı`} value={pain} disabled={readOnly} onChange={(event) => setPain(event.target.value as PainLevel)} onBlur={() => save()}><option value="none">Ağrı yok</option><option value="mild">Hafif ağrı</option><option value="moderate">Orta ağrı</option><option value="severe">Şiddetli ağrı</option></select>{pain !== 'none' && <input aria-label={`Set ${setNumber} ağrı bölgesi`} placeholder="Bölge (isteğe bağlı)" value={area} disabled={readOnly} onChange={(event) => setArea(event.target.value)} onBlur={() => save()} />}</div></div>
}

export function WorkoutSessionPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const view = useLiveQuery(() => sessionId ? service.getSessionView(sessionId) : undefined, [sessionId], null)
  const [info, setInfo] = useState<Exercise>()
  const [timer, setTimer] = useState({ seconds: 90, token: 0 })
  const [stopping, setStopping] = useState(false)
  const suggestions = useMemo(() => view?.targets.filter((target) => evaluateProgression(target, view.sets).eligible) ?? [], [view])
  if (view === null) return <div className="page-content"><p role="status">Antrenman açılıyor.</p></div>
  if (!view) return <div className="page-content"><PageHeader eyebrow="ANTRENMAN" title="Oturum bulunamadı" /><button className="secondary-button" onClick={() => navigate('/exercise')}>Egzersize dön</button></div>
  const exerciseById = new Map(view.exercises.map((exercise) => [exercise!.id, exercise!]))
  const isActive = view.session.status === 'in_progress'
  const stop = async () => { setStopping(true); await service.stopForHealth(view.session.id); setStopping(false) }
  const complete = async () => { await service.completeSession(view.session.id) }

  return <div className="page-content workout-session-page">
    <PageHeader eyebrow={isActive ? 'AKTİF ANTRENMAN' : 'ANTRENMAN ÖZETİ'} title={view.day.name} action={<button className="icon-button" aria-label="Antrenmandan çık" onClick={() => navigate('/today')}><X size={21} /></button>} />
    <RestTimer initialSeconds={timer.seconds} token={timer.token} enabled={isActive} />
    {view.session.status === 'stopped_for_health' && <div className="health-stop-message" role="alert"><AlertTriangle size={21} /><strong>Antrenman sağlık bildirimiyle durduruldu.</strong><span>Devam etmeden önce değerlendirme al.</span></div>}
    {view.session.status === 'completed' && <div className="session-complete"><Check size={24} /><strong>Antrenman tamamlandı</strong>{suggestions.length > 0 && <span>{suggestions.length} harekette bir sonraki antrenmanda yük artırılabilir.</span>}</div>}
    <div className="session-exercises">{view.targets.map((target: WorkoutExercise) => { const exercise = exerciseById.get(target.exerciseId); if (!exercise) return null; const sets = view.sets.filter((set) => set.exerciseId === exercise.id); return <section key={target.id} className="session-exercise"><header><div><h2>{exercise.name}</h2><span>{target.targetSets} × {target.targetRepMin}–{target.targetRepMax} · {target.restSeconds} sn</span></div><button aria-label={`${exercise.name} hareket bilgisini aç`} onClick={() => setInfo(exercise)}><Info size={19} /></button></header><div>{Array.from({ length: target.targetSets }, (_, index) => <SetRow key={index} sessionId={view.session.id} exerciseId={exercise.id} setNumber={index + 1} existing={sets.find((set) => set.setNumber === index + 1)} readOnly={!isActive} onCompleted={() => setTimer({ seconds: target.restSeconds, token: Date.now() })} onSeverePain={stop} />)}</div>{evaluateProgression(target, view.sets).eligible && <p className="progression-note">Bir sonraki antrenmanda yük artırılabilir.</p>}</section> })}</div>
    {view.session.status === 'in_progress' && <div className="session-actions"><button className="secondary-button health-stop" onClick={stop} disabled={stopping}><Square size={17} /> Yeni belirti / durdur</button><button className="primary-button" onClick={complete}><Check size={19} /> Antrenmanı tamamla</button></div>}
    <ExerciseInfoSheet exercise={info} open={Boolean(info)} onClose={() => setInfo(undefined)} />
  </div>
}
