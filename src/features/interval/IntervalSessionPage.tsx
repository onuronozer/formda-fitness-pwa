import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Pause, Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { UserRepository } from '../../db/repositories'
import type { CardioSession } from '../../domain/models'
import { DailyHealthService } from '../../services/DailyHealthService'
import { getIntervalTimerState, IntervalService } from '../../services/IntervalService'
import { ProfileService } from '../../services/ProfileService'
import { toLocalDate } from '../../utils/localDate'

const intervalService = new IntervalService()
const userRepository = new UserRepository()
const healthService = new DailyHealthService()
const profileService = new ProfileService()
const phaseLabels = { warmup: 'Isınma', work: 'Tempolu', recovery: 'Rahat', cooldown: 'Soğuma', complete: 'Tamamlandı' } as const
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

export function IntervalSessionPage() {
  const { protocolId = '' } = useParams()
  const navigate = useNavigate()
  const profile = useLiveQuery(() => userRepository.getActive())
  const protocol = useLiveQuery(() => intervalService.getProtocol(protocolId), [protocolId])
  const daily = useLiveQuery(() => profile ? healthService.getLatest(profile.id, toLocalDate(new Date())) : undefined, [profile?.id])
  const snapshot = useLiveQuery(() => profile ? profileService.load(profile.id) : undefined, [profile?.id])
  const [session, setSession] = useState<CardioSession>()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string>()
  const startedAt = useRef<number | undefined>(undefined)
  const accumulated = useRef(0)
  const finishing = useRef(false)
  const evaluation = daily?.evaluation ?? (snapshot ? profileService.evaluate(snapshot) : undefined)
  const timer = protocol ? getIntervalTimerState(protocol, elapsed) : undefined

  useEffect(() => {
    if (!running || !startedAt.current) return
    const update = () => setElapsed(accumulated.current + (Date.now() - startedAt.current!) / 1000)
    update(); const id = window.setInterval(update, 250)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!timer || timer.phase !== 'complete' || !session || finishing.current) return
    finishing.current = true; setRunning(false)
    void intervalService.finish(session.id, 'completed', protocol?.rounds ?? 0).then(setSession).catch(() => setMessage('Oturum kaydedilemedi.'))
  }, [protocol?.rounds, session, timer])

  const start = async () => {
    if (!profile || !evaluation || !protocol) return
    try {
      const created = await intervalService.start(profile.id, protocol.id, evaluation.status)
      setSession(created); accumulated.current = 0; startedAt.current = Date.now(); setRunning(true)
    } catch (error) { setMessage(error instanceof Error && error.message === 'HEALTH_BLOCKED' ? 'Bugünkü interval başlatılamıyor.' : 'Interval başlatılamadı.') }
  }
  const toggle = () => {
    if (running) { accumulated.current = elapsed; setRunning(false) }
    else { startedAt.current = Date.now(); setRunning(true) }
  }
  const stop = async () => {
    if (!session || !timer) return
    setRunning(false); const rounds = timer.phase === 'recovery' || timer.phase === 'cooldown' ? timer.round : Math.max(0, timer.round - 1)
    setSession(await intervalService.finish(session.id, 'stopped_early', rounds))
  }

  if (!protocol) return <div className="page-content interval-page"><PageHeader eyebrow="INTERVAL" title="Program bulunamadı" /></div>
  const ended = session && session.status !== 'in_progress'
  return <div className="page-content interval-page">
    <PageHeader eyebrow="YÜRÜYÜŞ INTERVAL" title={protocol.name} />
    {!session ? <section className="interval-intro"><div className="interval-duration"><strong>{Math.round((protocol.warmupSeconds + protocol.rounds * (protocol.workSeconds + protocol.recoverySeconds) + protocol.cooldownSeconds) / 60)}</strong><span>dk</span></div><dl><div><dt>Isınma</dt><dd>{protocol.warmupSeconds / 60} dk</dd></div><div><dt>Tempolu</dt><dd>{protocol.workSeconds / 60} dk</dd></div><div><dt>Rahat</dt><dd>{protocol.recoverySeconds / 60} dk × {protocol.rounds}</dd></div><div><dt>Soğuma</dt><dd>{protocol.cooldownSeconds / 60} dk</dd></div></dl><button className="primary-button" onClick={start} disabled={!evaluation}><Play size={19} /> Başlat</button></section>
      : ended ? <section className="interval-complete"><CheckCircle2 size={34} /><h2>{session.status === 'completed' ? 'Interval tamamlandı' : 'Oturum sonlandırıldı'}</h2><p>{session.roundsCompleted} / {protocol.rounds} tur</p><fieldset><legend>Nasıl hissettirdi?</legend>{[1, 2, 3, 4, 5].map((value) => <button key={value} className={session.perceivedDifficulty === value ? 'active' : ''} onClick={() => void intervalService.updateFeedback(session.id, value).then(setSession)}>{value}</button>)}</fieldset><button className="secondary-button" onClick={() => navigate('/today')}>Bugün'e dön</button></section>
        : timer && <section className={`interval-timer phase-${timer.phase}`}><span>{phaseLabels[timer.phase]}</span><strong>{formatTime(timer.phaseRemaining)}</strong><p>{timer.phase === 'warmup' ? 'Hazırlan' : timer.phase === 'cooldown' ? 'Temponu düşür' : `Tur ${timer.round} / ${timer.rounds}`}</p><div className="interval-total-progress"><span style={{ width: `${timer.totalElapsed / timer.totalSeconds * 100}%` }} /></div><div className="interval-controls"><button className="timer-main" aria-label={running ? 'Duraklat' : 'Devam et'} onClick={toggle}>{running ? <Pause size={25} /> : <Play size={25} />}</button><button aria-label="Intervali bitir" onClick={stop}><Square size={21} /></button></div></section>}
    {message && <p className="inline-message danger" role="alert">{message}</p>}
  </div>
}
