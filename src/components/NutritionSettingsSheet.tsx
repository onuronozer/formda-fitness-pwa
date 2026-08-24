import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NutritionActivityLevel, NutritionSettings } from '../domain/models'
import { NutritionTargetService } from '../services/NutritionTargetService'
import { reportTechnicalError } from '../utils/technicalError'

interface NutritionSettingsSheetProps { open: boolean; userId: string; onClose: () => void }
const targetService = new NutritionTargetService()
const numericKeys = ['manualEnergyKcal', 'manualProteinG', 'manualCarbohydrateG', 'manualFatG', 'manualFiberG', 'manualSodiumMg'] as const
type NumericKey = (typeof numericKeys)[number]

export function NutritionSettingsSheet({ open, userId, onClose }: NutritionSettingsSheetProps) {
  const [activityLevel, setActivityLevel] = useState<NutritionActivityLevel>('moderate')
  const [values, setValues] = useState<Record<NumericKey, string>>(Object.fromEntries(numericKeys.map((key) => [key, ''])) as Record<NumericKey, string>)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open || !userId) return
    setLoading(true); setError(undefined)
    void targetService.getSettings(userId).then((settings) => {
      setActivityLevel(settings.activityLevel)
      setValues(Object.fromEntries(numericKeys.map((key) => [key, settings[key]?.toString() ?? ''])) as Record<NumericKey, string>)
    }).catch((cause) => { reportTechnicalError('Nutrition settings load', cause); setError('Hedef ayarları açılamadı.') }).finally(() => setLoading(false))
  }, [open, userId])

  if (!open) return null

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!userId) return
    setSaving(true); setError(undefined)
    try {
      const changes: Partial<NutritionSettings> = { activityLevel }
      for (const key of numericKeys) changes[key] = values[key] ? Number(values[key]) : undefined
      await targetService.updateSettings(userId, changes)
      onClose()
    } catch (cause) { reportTechnicalError('Nutrition settings save', cause); setError('Değerleri kontrol edip tekrar dene.') }
    finally { setSaving(false) }
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="measurement-sheet nutrition-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="nutrition-settings-title">
      <header><span /><h2 id="nutrition-settings-title">Beslenme hedefleri</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header>
      {loading ? <div className="nutrition-sheet-loading"><LoaderCircle className="spin" size={24} /></div> : <form className="nutrition-settings-form" onSubmit={save}>
        <label><span>Aktivite düzeyi</span><select value={activityLevel} onChange={(event) => setActivityLevel(event.target.value as NutritionActivityLevel)}><option value="sedentary">Düşük</option><option value="light">Hafif</option><option value="moderate">Orta</option><option value="high">Yüksek</option></select></label>
        <p>Boş alanlar profilinden hesaplanır. Manuel değerler yeni günlerde oluşturulan hedeflere uygulanır.</p>
        <div className="nutrition-target-grid">
          <TargetInput label="Enerji" unit="kcal" value={values.manualEnergyKcal} onChange={(value) => setValues((current) => ({ ...current, manualEnergyKcal: value }))} />
          <TargetInput label="Protein" unit="g" value={values.manualProteinG} onChange={(value) => setValues((current) => ({ ...current, manualProteinG: value }))} />
          <TargetInput label="Karbonhidrat" unit="g" value={values.manualCarbohydrateG} onChange={(value) => setValues((current) => ({ ...current, manualCarbohydrateG: value }))} />
          <TargetInput label="Yağ" unit="g" value={values.manualFatG} onChange={(value) => setValues((current) => ({ ...current, manualFatG: value }))} />
          <TargetInput label="Lif" unit="g" value={values.manualFiberG} onChange={(value) => setValues((current) => ({ ...current, manualFiberG: value }))} />
          <TargetInput label="Sodyum" unit="mg" value={values.manualSodiumMg} onChange={(value) => setValues((current) => ({ ...current, manualSodiumMg: value }))} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} /> Kaydediliyor</> : 'Kaydet'}</button>
      </form>}
    </section>
  </div>
}

function TargetInput({ label, unit, value, onChange }: { label: string; unit: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><div><input type="number" min="1" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Otomatik" /><b>{unit}</b></div></label>
}
