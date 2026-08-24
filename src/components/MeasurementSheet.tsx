import { ChevronLeft, Footprints, LoaderCircle, Ruler, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import type { StepRecord, WaistRecord, WeightRecord } from '../domain/models'
import { MeasurementService, type MeasurementKind } from '../services/MeasurementService'
import { isoToLocalTime, toLocalDate } from '../utils/localDate'
import { reportTechnicalError } from '../utils/technicalError'

export type MeasurementRecord = WeightRecord | WaistRecord | StepRecord

interface MeasurementSheetProps {
  open: boolean
  userId: string
  initialKind?: MeasurementKind
  record?: MeasurementRecord
  onClose: () => void
  onSaved?: () => void
}

const measurementService = new MeasurementService()
const labels = { weight: 'Kilo', waist: 'Bel', steps: 'Adım' }

export function MeasurementSheet({ open, userId, initialKind, record, onClose, onSaved }: MeasurementSheetProps) {
  const [kind, setKind] = useState<MeasurementKind | undefined>(initialKind)
  const [value, setValue] = useState('')
  const [localDate, setLocalDate] = useState(toLocalDate(new Date()))
  const [time, setTime] = useState(isoToLocalTime(new Date().toISOString()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind(initialKind)
    setError(undefined)
    setValue(record ? 'valueKg' in record ? String(record.valueKg) : 'valueCm' in record ? String(record.valueCm) : String(record.stepCount) : '')
    setLocalDate(record?.localDate ?? toLocalDate(new Date()))
    setTime(record && 'measuredAt' in record ? isoToLocalTime(record.measuredAt) : isoToLocalTime(new Date().toISOString()))
    setNote(record && 'note' in record ? record.note ?? '' : '')
  }, [open, initialKind, record])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!kind) return
    if (!userId) { setError('Profil bulunamadı.'); return }
    setSaving(true); setError(undefined)
    try {
      if (kind === 'weight') await measurementService.saveWeight(userId, { valueKg: value, localDate, time, note }, record as WeightRecord | undefined)
      else if (kind === 'waist') await measurementService.saveWaist(userId, { valueCm: value, localDate, time, note }, record as WaistRecord | undefined)
      else await measurementService.saveSteps(userId, { stepCount: value, localDate }, record as StepRecord | undefined)
      onSaved?.(); onClose()
    } catch (cause) {
      reportTechnicalError('Measurement save', cause)
      setError(cause instanceof z.ZodError ? cause.issues[0]?.message : cause instanceof Error ? cause.message : 'Kayıt kaydedilemedi.')
    } finally { setSaving(false) }
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="measurement-sheet" role="dialog" aria-modal="true" aria-labelledby="measurement-sheet-title">
      <header>
        {kind && !record ? <button className="icon-button" aria-label="Ölçüm türlerine dön" onClick={() => { setKind(undefined); setError(undefined) }}><ChevronLeft size={21} /></button> : <span />}
        <h2 id="measurement-sheet-title">{record ? `${labels[kind!]} düzenle` : kind ? `${labels[kind]} ekle` : 'Hızlı Ekle'}</h2>
        <button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button>
      </header>
      {!kind ? <div className="quick-add-options">
        <button onClick={() => setKind('weight')}><span className="weight"><Scale size={22} /></span><strong>Kilo</strong><small>kg</small></button>
        <button onClick={() => setKind('waist')}><span className="waist"><Ruler size={22} /></span><strong>Bel</strong><small>cm</small></button>
        <button onClick={() => setKind('steps')}><span className="steps"><Footprints size={22} /></span><strong>Adım</strong><small>günlük</small></button>
      </div> : <form className="measurement-form" onSubmit={submit}>
        <label className="measurement-value-field"><span>{labels[kind]}</span><div><input autoFocus inputMode="decimal" type="number" step={kind === 'steps' ? 1 : 0.1} min={kind === 'weight' ? 30 : kind === 'waist' ? 40 : 0} value={value} onChange={(event) => setValue(event.target.value)} placeholder={kind === 'weight' ? '86.4' : kind === 'waist' ? '94' : '6420'} required /><b>{kind === 'weight' ? 'kg' : kind === 'waist' ? 'cm' : 'adım'}</b></div></label>
        <div className="measurement-date-row"><label><span>Gün</span><input type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} required /></label>{kind !== 'steps' && <label><span>Saat</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>}</div>
        {kind !== 'steps' && <label className="measurement-note"><span>Not <small>isteğe bağlı</small></span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Kısa not" /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={19} /> Kaydediliyor</> : 'Kaydet'}</button>
      </form>}
    </section>
  </div>
}
