import { addDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Coffee, Cookie, Pencil, Plus, Settings2, Soup, Trash2, Utensils } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FoodPickerSheet } from '../../components/FoodPickerSheet'
import { MealItemEditSheet } from '../../components/MealItemEditSheet'
import { NutritionSettingsSheet } from '../../components/NutritionSettingsSheet'
import { NutritionSummary } from '../../components/NutritionSummary'
import { PageHeader } from '../../components/PageHeader'
import type { MealType } from '../../domain/enums'
import type { MealItem } from '../../domain/models'
import { UserRepository } from '../../db/repositories'
import { MealService } from '../../services/MealService'
import { NutritionCalculationService, formatNutrition } from '../../services/NutritionCalculationService'
import { NutritionTargetService } from '../../services/NutritionTargetService'
import { toLocalDate } from '../../utils/localDate'
import { reportTechnicalError } from '../../utils/technicalError'

const userRepository = new UserRepository()
const mealService = new MealService()
const targetService = new NutritionTargetService()
const calculation = new NutritionCalculationService()

const mealDefinitions: Array<{ type: MealType; label: string; icon: typeof Coffee }> = [
  { type: 'BREAKFAST', label: 'Kahvaltı', icon: Coffee },
  { type: 'LUNCH', label: 'Öğle', icon: Soup },
  { type: 'DINNER', label: 'Akşam', icon: Utensils },
  { type: 'SNACK', label: 'Ara Öğün', icon: Cookie },
]

export function NutritionPage() {
  const [localDate, setLocalDate] = useState(toLocalDate(new Date()))
  const [addingTo, setAddingTo] = useState<MealType>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MealItem>()
  const [message, setMessage] = useState<string>()
  const targetRequest = useRef<string | undefined>(undefined)
  const profile = useLiveQuery(() => userRepository.getActive())
  const day = useLiveQuery(() => profile ? mealService.getDay(profile.id, localDate) : [], [profile?.id, localDate], [])
  const total = useLiveQuery(() => profile ? mealService.getDailyTotal(profile.id, localDate) : undefined, [profile?.id, localDate])
  const target = useLiveQuery(() => profile ? targetService.get(profile.id, localDate) : undefined, [profile?.id, localDate])
  const today = toLocalDate(new Date())
  useEffect(() => {
    if (!profile) return
    const key = `${profile.id}:${localDate}`
    if (targetRequest.current === key) return
    targetRequest.current = key
    void targetService.getOrCreate(profile.id, localDate).catch((error) => { targetRequest.current = undefined; reportTechnicalError('Nutrition target create', error) })
  }, [profile, localDate])

  const removeItem = async (item: MealItem) => {
    if (!profile) return
    setMessage(undefined)
    try { await mealService.deleteItem(profile.id, item.id) }
    catch (error) { reportTechnicalError('Meal item delete', error); setMessage('Kayıt silinemedi.') }
  }

  return <div className="page-content nutrition-page">
    <PageHeader eyebrow="GÜNLÜK KAYIT" title="Beslenme" action={<button className="icon-button nutrition-settings-button" aria-label="Beslenme hedefleri" title="Beslenme hedefleri" onClick={() => setSettingsOpen(true)}><Settings2 size={20} /></button>} />
    <div className="nutrition-date-nav">
      <button aria-label="Önceki gün" onClick={() => setLocalDate(toLocalDate(addDays(parseISO(localDate), -1)))}><ChevronLeft size={20} /></button>
      <div><strong>{localDate === today ? 'Bugün' : format(parseISO(localDate), 'd MMMM', { locale: tr })}</strong><span>{format(parseISO(localDate), 'EEEE', { locale: tr })}</span></div>
      <button aria-label="Sonraki gün" disabled={localDate >= today} onClick={() => setLocalDate(toLocalDate(addDays(parseISO(localDate), 1)))}><ChevronRight size={20} /></button>
    </div>

    <NutritionSummary total={total} target={target} />
    {message && <p className="form-error" role="alert">{message}</p>}

    <div className="meal-groups">{mealDefinitions.map(({ type, label, icon: Icon }) => {
      const entry = day.find(({ meal }) => meal.mealType === type)
      const mealTotal = calculation.dailyTotal(entry?.items.map((item) => item.nutritionSnapshot) ?? [])
      return <section className="meal-group" key={type}>
        <header><span className="meal-icon"><Icon size={19} /></span><div><h2>{label}</h2><small>{entry?.items.length ? `${formatNutrition.kcal(mealTotal.nutrients.energyKcal)} kcal` : 'Henüz kayıt yok'}</small></div><button aria-label={`${label} öğününe ekle`} onClick={() => setAddingTo(type)}><Plus size={20} /></button></header>
        {entry?.items.map((item) => <article className="meal-item" key={item.id}><div><strong>{item.displayNameSnapshot}</strong><span>{item.servingSnapshot?.label ?? `${formatNutrition.grams(item.amountG)} g`} · {formatNutrition.kcal(item.nutritionSnapshot.nutrients.energyKcal)} kcal</span></div><div className="meal-item-macros"><span>P {formatNutrition.grams(item.nutritionSnapshot.nutrients.proteinG)}</span><span>K {formatNutrition.grams(item.nutritionSnapshot.nutrients.carbohydrateG)}</span><span>Y {formatNutrition.grams(item.nutritionSnapshot.nutrients.fatG)}</span></div><div className="meal-item-actions"><button aria-label={`${item.displayNameSnapshot} miktarını düzenle`} title="Düzenle" onClick={() => setEditingItem(item)}><Pencil size={17} /></button><button aria-label={`${item.displayNameSnapshot} kaydını sil`} title="Sil" onClick={() => void removeItem(item)}><Trash2 size={17} /></button></div></article>)}
      </section>
    })}</div>

    <FoodPickerSheet open={Boolean(addingTo)} userId={profile?.id ?? ''} localDate={localDate} mealType={addingTo ?? 'BREAKFAST'} onClose={() => setAddingTo(undefined)} />
    <MealItemEditSheet item={editingItem} userId={profile?.id ?? ''} onClose={() => setEditingItem(undefined)} />
    <NutritionSettingsSheet open={settingsOpen} userId={profile?.id ?? ''} onClose={() => setSettingsOpen(false)} />
  </div>
}
