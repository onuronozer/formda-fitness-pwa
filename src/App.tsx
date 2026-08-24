import React, { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { initializeDatabase } from './db/database'
import { UserRepository } from './db/repositories'
import { ensureSeedVersions } from './seed/seedService'
import { AppLayout } from './app/AppLayout'
import { accountService } from './services/AccountService'
import { reportTechnicalError } from './utils/technicalError'
import { clearStaleBundleRecovery, recoverFromStaleBundle } from './utils/staleBundleRecovery'

const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))
const TodayPage = lazy(() => import('./features/today/TodayPage').then((module) => ({ default: module.TodayPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ProgressPage = lazy(() => import('./features/progress/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const ExercisePage = lazy(() => import('./features/exercise/ExercisePage').then((module) => ({ default: module.ExercisePage })))
const NutritionPage = lazy(() => import('./features/nutrition/NutritionPage').then((module) => ({ default: module.NutritionPage })))
const WorkoutSessionPage = lazy(() => import('./features/workout/WorkoutSessionPage').then((module) => ({ default: module.WorkoutSessionPage })))
const IntervalSessionPage = lazy(() => import('./features/interval/IntervalSessionPage').then((module) => ({ default: module.IntervalSessionPage })))
const AuthPage = lazy(() => import('./features/auth/AuthPage').then((module) => ({ default: module.AuthPage })))

const userRepository = new UserRepository()

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean; technicalCode?: string }> {
  state: { failed: boolean; technicalCode?: string } = { failed: false }
  static getDerivedStateFromError(error: Error) {
    return { failed: true, technicalCode: `${error.name}: ${error.message}`.slice(0, 180) }
  }
  componentDidCatch(error: Error) {
    reportTechnicalError('AppErrorBoundary', error)
    recoverFromStaleBundle(error)
  }
  render() {
    if (this.state.failed) return <SystemMessage title="Bir şeyler ters gitti" message="Sayfayı güncelleyip tekrar dene." technicalCode={this.state.technicalCode} action={{ label: 'Yeniden yükle', run: () => { clearStaleBundleRecovery(); window.location.reload() } }} />
    return this.props.children
  }
}

function SystemMessage({ title, message, loading = false, action, technicalCode }: { title: string; message: string; loading?: boolean; action?: { label: string; run: () => void }; technicalCode?: string }) {
  return (
    <main className="system-screen" role={loading ? 'status' : 'alert'}>
      {loading ? <LoaderCircle className="spin" size={28} /> : <AlertTriangle size={28} />}
      <h1>{title}</h1><p>{message}</p>
      {technicalCode && <code className="technical-error-code">{technicalCode}</code>}
      {action && <button className="primary-button" onClick={action.run}><RefreshCw size={18} /> {action.label}</button>}
    </main>
  )
}

function InitialRedirect() {
  const profile = useLiveQuery(() => userRepository.getActive(), [], null)
  if (profile === null) return <SystemMessage title="Formda hazırlanıyor" message="Yerel verilerin kontrol ediliyor." loading />
  return <Navigate to={profile ? { pathname: '/today', search: window.location.search } : '/auth'} replace />
}

function ProtectedRoutes() {
  const profile = useLiveQuery(() => userRepository.getActive(), [], null)
  if (profile === null) return <SystemMessage title="Formda hazırlanıyor" message="Yerel verilerin kontrol ediliyor." loading />
  if (!profile) return <Navigate to="/auth" replace />
  return <Outlet />
}

function AppRouter() {
  return (
    <Suspense fallback={<SystemMessage title="Formda hazırlanıyor" message="Ekran yükleniyor." loading />}><Routes>
      <Route path="/" element={<InitialRedirect />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<ProtectedRoutes />}>
        <Route element={<AppLayout />}>
          <Route path="/today" element={<TodayPage />} />
          <Route path="/exercise" element={<ExercisePage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/workout/session/:sessionId" element={<WorkoutSessionPage />} />
          <Route path="/interval/:protocolId" element={<IntervalSessionPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    initializeDatabase().then(() => ensureSeedVersions()).then(() => {
      setStatus('ready')
      void accountService.initialize().catch(() => undefined)
    }).catch((error) => {
      reportTechnicalError('Database initialization', error)
      setStatus('failed')
    })
  }, [])
  if (status === 'loading') return <SystemMessage title="Formda hazırlanıyor" message="Yerel veritabanı açılıyor." loading />
  if (status === 'failed') return <SystemMessage title="Veriler açılamadı" message="Tarayıcı depolama iznini kontrol edip tekrar dene." />
  return <AppErrorBoundary><AppRouter /></AppErrorBoundary>
}
