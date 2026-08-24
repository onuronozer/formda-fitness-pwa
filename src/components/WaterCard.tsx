import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Droplets, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { HYDRATION_CONFIG } from '../config/phase3b'
import type { WaterRecord } from '../domain/models'
import { WaterService } from '../services/WaterService'

const waterService = new WaterService()

export function WaterCard({ userId, localDate, targetMl }: { userId: string; localDate: string; targetMl?: number }) {
  const records = useLiveQuery(() => waterService.listForDate(userId, localDate), [userId, localDate], [])
  const [customOpen, setCustomOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState<WaterRecord>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const total = records.reduce((sum, record) => sum + record.amountMl, 0)
  const target = targetMl ?? HYDRATION_CONFIG.targetMl.default
  const progress = Math.min(100, Math.round(total / target * 100))

  const quickAdd = async (value: number) => {
    setBusy(true); setMessage(undefined)
    try { await waterService.add(userId, value, 'quick_add'); setMessage(`${value} ml eklendi.`) }
    catch { setMessage('Su eklenemedi.') }
    finally { setBusy(false) }
  }
  const saveCustom = async () => {
    setBusy(true); setMessage(undefined)
    try {
      if (editing) await waterService.update(editing.id, amount, editing.consumedAt)
      else await waterService.add(userId, amount, 'manual')
      setMessage(editing ? 'Kayıt güncellendi.' : `${amount} ml eklendi.`); setAmount(''); setEditing(undefined); setCustomOpen(false)
    } catch { setMessage(`Miktar ${HYDRATION_CONFIG.amountMl.min}-${HYDRATION_CONFIG.amountMl.max} ml olmalı.`) }
    finally { setBusy(false) }
  }
  const edit = (record: WaterRecord) => { setEditing(record); setAmount(String(record.amountMl)); setCustomOpen(true) }

  return <section className="water-card" aria-labelledby="water-title">
    <header><div className="water-heading"><span><Droplets size={20} /></span><div><small>SU</small><strong id="water-title">{total.toLocaleString('tr-TR')} / {target.toLocaleString('tr-TR')} ml</strong></div></div><button className="text-command" onClick={() => setHistoryOpen((value) => !value)}>{historyOpen ? 'Kapat' : 'Geçmiş'}</button></header>
    <div className="water-progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={total}><span style={{ width: `${progress}%` }} /></div>
    <div className="water-quick-grid">{HYDRATION_CONFIG.quickAmountsMl.map((value) => <button key={value} onClick={() => quickAdd(value)} disabled={busy}><Plus size={15} />{value}</button>)}<button className="water-other" onClick={() => { setEditing(undefined); setAmount(''); setCustomOpen(true) }}><Plus size={15} />Diğer</button></div>
    {customOpen && <div className="water-custom"><label><span className="visually-hidden">Su miktarı</span><input autoFocus inputMode="numeric" type="number" min={HYDRATION_CONFIG.amountMl.min} max={HYDRATION_CONFIG.amountMl.max} step={HYDRATION_CONFIG.amountMl.step} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="250" /><b>ml</b></label><button aria-label="Kaydet" onClick={saveCustom} disabled={busy}><Check size={19} /></button><button aria-label="Vazgeç" onClick={() => { setCustomOpen(false); setEditing(undefined) }}><X size={19} /></button></div>}
    {historyOpen && <div className="water-history">{records.length === 0 ? <p>Bugün henüz kayıt yok.</p> : records.map((record) => <div key={record.id}><time>{new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(record.consumedAt))}</time><strong>{record.amountMl} ml</strong><button aria-label={`${record.amountMl} ml kaydını düzenle`} onClick={() => edit(record)}><Pencil size={16} /></button><button aria-label={`${record.amountMl} ml kaydını sil`} onClick={() => void waterService.remove(record.id)}><Trash2 size={16} /></button></div>)}</div>}
    {message && <p className="water-message" role="status">{message}</p>}
  </section>
}
