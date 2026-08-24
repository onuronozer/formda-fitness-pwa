import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MealItem } from '../domain/models'
import { MealService } from '../services/MealService'
import { reportTechnicalError } from '../utils/technicalError'

interface MealItemEditSheetProps { item?: MealItem; userId: string; onClose: () => void }
const mealService = new MealService()

export function MealItemEditSheet({ item, userId, onClose }: MealItemEditSheetProps) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!item) return
    const servings = item.recipeId && item.servingSnapshot?.label ? Number.parseFloat(item.servingSnapshot.label.replace(',', '.')) : undefined
    setAmount(String(servings && Number.isFinite(servings) ? servings : item.amountG)); setError(undefined)
  }, [item])
  if (!item) return null
  const isRecipe = Boolean(item.recipeId)
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(undefined)
    try { await mealService.updateItem(userId, item.id, isRecipe ? { servings: Number(amount) } : { amountG: Number(amount) }); onClose() }
    catch (cause) { reportTechnicalError('Meal item update', cause); setError('Miktarı kontrol edip tekrar dene.') }
    finally { setSaving(false) }
  }
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="measurement-sheet meal-item-edit-sheet" role="dialog" aria-modal="true" aria-labelledby="meal-item-edit-title"><header><span /><h2 id="meal-item-edit-title">Miktarı düzenle</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header><form className="nutrition-editor" onSubmit={save}><p className="meal-item-edit-name">{item.displayNameSnapshot}</p><label className="nutrition-amount"><span>{isRecipe ? 'Porsiyon' : 'Miktar'}</span><div><input autoFocus required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><b>{isRecipe ? 'porsiyon' : 'g'}</b></div></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} /> Kaydediliyor</> : 'Kaydet'}</button></form></section></div>
}
