import { Flame } from 'lucide-react'
import type { DailyNutritionTarget, DailyNutritionTotal } from '../domain/models'
import { formatNutrition } from '../services/NutritionCalculationService'

interface NutritionSummaryProps {
  total?: DailyNutritionTotal
  target?: DailyNutritionTarget
  compact?: boolean
}

const ratio = (value: number | null | undefined, target: number | undefined) => target && value !== null && value !== undefined
  ? Math.min(1, value / target)
  : 0

export function NutritionSummary({ total, target, compact = false }: NutritionSummaryProps) {
  const energy = total?.nutrients.energyKcal
  const macros = [
    { label: 'Protein', value: total?.nutrients.proteinG, target: target?.proteinG, className: 'protein' },
    { label: 'Karbonhidrat', value: total?.nutrients.carbohydrateG, target: target?.carbohydrateG, className: 'carbs' },
    { label: 'Yağ', value: total?.nutrients.fatG, target: target?.fatG, className: 'fat' },
  ]

  return <section className={`nutrition-summary ${compact ? 'compact' : ''}`} aria-label="Günlük beslenme özeti">
    <div className="nutrition-energy">
      <span><Flame size={compact ? 18 : 21} /></span>
      <div><strong>{formatNutrition.kcal(energy)}</strong><small>/ {target ? formatNutrition.kcal(target.energyKcal) : '--'} kcal</small></div>
      <div className="nutrition-energy-track" aria-hidden="true"><i style={{ width: `${ratio(energy, target?.energyKcal) * 100}%` }} /></div>
    </div>
    <div className="nutrition-macros">{macros.map((macro) => <div key={macro.label}>
      <span>{macro.label}</span><strong>{formatNutrition.grams(macro.value)}<small> / {formatNutrition.grams(macro.target)} g</small></strong>
      <i className={macro.className}><b style={{ width: `${ratio(macro.value, macro.target) * 100}%` }} /></i>
    </div>)}</div>
    {!compact && total && total.itemCount > 0 && total.completeness.energyKcal < 1 && <p>Bazı kayıtlarda enerji verisi bilinmiyor; toplam yalnız bilinen değerleri içerir.</p>}
  </section>
}
