import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DAILY_GOAL_CONFIG, HYDRATION_CONFIG } from '../../config/phase3b'
import { DailyGoalService } from '../../services/DailyGoalService'
import { appDb } from '../../db/database'

const service = new DailyGoalService()

export function GoalSettingsPanel({ userId }: { userId: string }) {
  const settings = useLiveQuery(() => appDb.dailyGoalSettings.where('userId').equals(userId).first(), [userId], null)
  const [stepMode, setStepMode] = useState<'adaptive' | 'manual'>('adaptive')
  const [stepTarget, setStepTarget] = useState(String(DAILY_GOAL_CONFIG.defaultStepBaseline))
  const [hydrationMode, setHydrationMode] = useState<'program' | 'manual' | 'fluid_restriction'>('program')
  const [hydrationTarget, setHydrationTarget] = useState(String(HYDRATION_CONFIG.targetMl.default))
  const [message, setMessage] = useState<string>()
  useEffect(() => {
    if (settings === undefined) { void service.getSettings(userId); return }
    if (!settings) return
    setStepMode(settings.stepMode); setStepTarget(String(settings.manualStepTarget ?? settings.currentStepBaseline)); setHydrationMode(settings.hydrationMode); setHydrationTarget(String(settings.manualHydrationTargetMl ?? HYDRATION_CONFIG.targetMl.default))
  }, [settings, userId])
  const save = async () => {
    try {
      await service.updateSettings(userId, { stepMode, manualStepTarget: stepMode === 'manual' ? Number(stepTarget) : undefined, hydrationMode, manualHydrationTargetMl: hydrationMode === 'manual' ? Number(hydrationTarget) : undefined })
      setMessage('Hedef ayarları güncellendi.')
    } catch { setMessage('Hedef değerlerini kontrol et.') }
  }
  return <section className="settings-section goal-settings"><h2>Günlük hedefler</h2><div className="goal-setting-row"><span>Adım hedefi</span><div className="settings-segmented"><button className={stepMode === 'adaptive' ? 'active' : ''} onClick={() => setStepMode('adaptive')}>Adaptif</button><button className={stepMode === 'manual' ? 'active' : ''} onClick={() => setStepMode('manual')}>Manuel</button></div>{stepMode === 'manual' && <label><input aria-label="Manuel adım hedefi" type="number" min={DAILY_GOAL_CONFIG.stepTarget.min} max={DAILY_GOAL_CONFIG.stepTarget.max} step={DAILY_GOAL_CONFIG.stepTarget.roundTo} value={stepTarget} onChange={(event) => setStepTarget(event.target.value)} /><b>adım</b></label>}</div><div className="goal-setting-row"><span>Su hedefi</span><select value={hydrationMode} onChange={(event) => setHydrationMode(event.target.value as typeof hydrationMode)}><option value="program">Varsayılan</option><option value="manual">Ben belirleyeceğim</option><option value="fluid_restriction">Otomatik hedef yok</option></select>{hydrationMode === 'manual' && <label><input aria-label="Manuel su hedefi" type="number" min={HYDRATION_CONFIG.targetMl.min} max={HYDRATION_CONFIG.targetMl.max} step={HYDRATION_CONFIG.targetMl.step} value={hydrationTarget} onChange={(event) => setHydrationTarget(event.target.value)} /><b>ml</b></label>}</div><button className="secondary-button compact-button" onClick={save}><Check size={17} /> Kaydet</button>{message && <p className="inline-message success" role="status">{message}</p>}</section>
}
