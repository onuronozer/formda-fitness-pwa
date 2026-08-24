import { ArrowRight, ChevronLeft, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { AppLogo } from '../../components/AppLogo'
import { UserRepository } from '../../db/repositories'
import { ProfileService, type ProfileSnapshot } from '../../services/ProfileService'
import { useOnboardingStore, type OnboardingDraft } from '../../stores/onboardingStore'
import { userProfileInputSchema } from '../../validation/profileSchemas'
import { BasicInfoStep } from './steps/BasicInfoStep'
import { ConditionsStep } from './steps/ConditionsStep'
import { GoalStep } from './steps/GoalStep'
import { HealthQuestionsStep } from './steps/HealthQuestionsStep'
import { SummaryStep } from './steps/SummaryStep'
import { TrainingStep } from './steps/TrainingStep'
import { reportTechnicalError } from '../../utils/technicalError'

const profileService = new ProfileService()
const userRepository = new UserRepository()

const basicSchema = userProfileInputSchema.pick({ displayName: true, birthDate: true, sex: true, heightCm: true })
const goalSchema = userProfileInputSchema.pick({ currentWeightKg: true, targetWeightKg: true, waistCm: true, primaryGoal: true })
const trainingSchema = userProfileInputSchema.pick({ experienceLevel: true, trainingDaysPerWeek: true, trainingLocation: true, availableEquipment: true })

function validateStep(step: number, draft: OnboardingDraft): string | undefined {
  const payload = { ...draft, waistCm: draft.waistCm === '' ? undefined : draft.waistCm }
  const result = step === 1 ? basicSchema.safeParse(payload) : step === 2 ? goalSchema.safeParse(payload) : step === 3 ? trainingSchema.safeParse(payload) : { success: true as const }
  if (result.success) return undefined
  return z.prettifyError(result.error).split('\n')[0] || 'Alanları kontrol et.'
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editing = params.get('edit') === '1'
  const hydrated = useRef(false)
  const [existing, setExisting] = useState<ProfileSnapshot>()
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const { step, draft, setStep, updateDraft, setHealthAnswer, toggleCondition, hydrate, reset } = useOnboardingStore()

  useEffect(() => {
    if (!editing || hydrated.current) return
    hydrated.current = true
    userRepository.getActive().then((profile) => profile ? profileService.load(profile.id) : undefined).then((snapshot) => {
      if (!snapshot) { navigate('/', { replace: true }); return }
      setExisting(snapshot)
      hydrate(profileService.toDraft(snapshot), snapshot.profile.id)
      setLoading(false)
    }).catch((cause) => { reportTechnicalError('Onboarding edit load', cause); setError('Profil bilgileri açılamadı.'); setLoading(false) })
  }, [editing, hydrate, navigate])

  const evaluation = useMemo(() => {
    try { return profileService.evaluate(profileService.buildSnapshot(draft, existing)) } catch { return undefined }
  }, [draft, existing])

  const next = () => {
    const validationError = validateStep(step, draft)
    if (validationError) { setError(validationError); return }
    setError(undefined)
    setStep(Math.min(6, step + 1))
  }

  const back = () => {
    setError(undefined)
    if (step > 1) setStep(step - 1)
    else if (editing) navigate('/profile')
  }

  const save = async () => {
    setSaving(true); setError(undefined)
    try {
      await profileService.save(draft, existing)
      reset()
      navigate('/today', { replace: true })
    } catch (cause) {
      reportTechnicalError('Profile save', cause)
      setError(cause instanceof z.ZodError ? 'Bilgilerinde eksik veya geçersiz alanlar var.' : 'Profil kaydedilemedi. Tekrar dene.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="system-screen"><LoaderCircle className="spin" size={28} /><h1>Profil açılıyor</h1></main>

  return <main className="app-canvas"><section className="onboarding-shell">
    <header className="topbar"><button className="icon-button" aria-label="Geri" onClick={back} disabled={step === 1 && !editing}><ChevronLeft size={22} /></button><AppLogo compact /><span className="step-label">{step} / 6</span></header>
    <div className="progress-track" aria-label="Onboarding ilerlemesi" aria-valuenow={step} aria-valuemin={1} aria-valuemax={6} role="progressbar"><span style={{ width: `${step / 6 * 100}%` }} /></div>
    <div className="onboarding-content">
      {step === 1 && <BasicInfoStep draft={draft} update={updateDraft} />}
      {step === 2 && <GoalStep draft={draft} update={updateDraft} lockCurrentWeight={editing} />}
      {step === 3 && <TrainingStep draft={draft} update={updateDraft} />}
      {step === 4 && <ConditionsStep draft={draft} toggle={toggleCondition} />}
      {step === 5 && <HealthQuestionsStep draft={draft} setAnswer={setHealthAnswer} />}
      {step === 6 && evaluation && <SummaryStep draft={draft} evaluation={evaluation} />}
    </div>
    <footer className="sticky-action">{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" onClick={step === 6 ? save : next} disabled={saving || (step === 6 && !evaluation)}>{saving ? <><LoaderCircle className="spin" size={19} /> Kaydediliyor</> : <>{step === 6 ? (editing ? 'Profili güncelle' : 'Profili oluştur') : 'Devam et'} <ArrowRight size={19} /></>}</button></footer>
  </section></main>
}
