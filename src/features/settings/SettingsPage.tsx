import { Cloud, Download, FileJson, HardDrive, RefreshCw, Smartphone, Upload } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { BackupService, BackupValidationError } from '../../services/BackupService'
import { UserRepository } from '../../db/repositories'
import { CloudSyncPanel } from './CloudSyncPanel'
import { GoalSettingsPanel } from './GoalSettingsPanel'
import { ShortcutPanel } from './ShortcutPanel'
import { CLINICAL_RELEASE_STATUS } from '../../config/release'
import { reportTechnicalError } from '../../utils/technicalError'

const backupService = new BackupService()
const userRepository = new UserRepository()

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online
}

export function SettingsPage() {
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()
  const [busy, setBusy] = useState(false)
  const profile = useLiveQuery(() => userRepository.getActive())

  const exportBackup = async () => {
    setBusy(true); setMessage(undefined)
    try {
      const data = await backupService.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `formda-backup-${data.exportedAt.slice(0, 10)}.json`; link.click()
      URL.revokeObjectURL(url)
      setMessage({ tone: 'success', text: 'Yedek dosyası hazır.' })
    } catch (error) { reportTechnicalError('Backup export', error); setMessage({ tone: 'danger', text: 'Yedek oluşturulamadı.' }) }
    finally { setBusy(false) }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    setBusy(true); setMessage(undefined)
    try {
      const json: unknown = JSON.parse(await file.text())
      await backupService.importData(json)
      setMessage({ tone: 'success', text: 'Veriler geri yüklendi.' })
      setTimeout(() => navigate('/today'), 500)
    } catch (error) {
      reportTechnicalError('Backup import', error)
      setMessage({ tone: 'danger', text: error instanceof BackupValidationError || error instanceof SyntaxError ? 'Bu dosya geçerli bir Formda yedeği değil.' : 'Veriler geri yüklenemedi.' })
    } finally { setBusy(false); if (fileInput.current) fileInput.current.value = '' }
  }

  return <div className="page-content">
    <PageHeader eyebrow="YEREL VE GÜVENLİ" title="Ayarlar" />
    <section className="settings-section"><h2>Gizlilik ve Veriler</h2><p>Temel verilerin bu cihazda kalır. Cloud Sync'i yalnız sen açarsın.</p><dl className="settings-list"><div><HardDrive size={19} /><dt>Yerel veri</dt><dd>Bu cihazda</dd></div><div><Cloud size={19} /><dt>Cloud kopya</dt><dd>İsteğe bağlı</dd></div></dl></section>
    {profile && <CloudSyncPanel userId={profile.id} />}
    {profile && <GoalSettingsPanel userId={profile.id} />}
    <section className="settings-section"><h2>Veri yedeği</h2><p>Hassas sağlık verileri içerebilir. Yedek dosyanı güvenli bir yerde tut.</p><div className="settings-actions">
      <button className="primary-button compact-button" onClick={exportBackup} disabled={busy}>{busy ? <RefreshCw className="spin" size={18} /> : <Download size={18} />} Dışa aktar</button>
      <button className="secondary-button compact-button" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={18} /> Geri yükle</button>
      <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} />
    </div>{message && <p className={`inline-message ${message.tone}`} role="status">{message.text}</p>}</section>
    <section className="settings-section"><h2>Durum</h2><dl className="settings-list">
      <div><Smartphone size={19} /><dt>Depolama</dt><dd>Bu cihaz</dd></div>
      <div><FileJson size={19} /><dt>Yedek formatı</dt><dd>JSON v5</dd></div>
      <div><span className="review-dot" /><dt>Klinik sürüm</dt><dd>{CLINICAL_RELEASE_STATUS === 'CLINICAL_REVIEW_PENDING' ? 'İnceleme bekliyor' : 'Kontrollü'}</dd></div>
      <div><span className={`online-dot ${online ? 'online' : ''}`} /><dt>Bağlantı</dt><dd>{online ? 'Çevrimiçi' : 'Çevrimdışı'}</dd></div>
    </dl></section>
    <ShortcutPanel />
    <p className="settings-footnote">Formda v{__APP_VERSION__} · HealthKit bu sürümde desteklenmez.</p>
  </div>
}
