import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Heart, LoaderCircle, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NUTRIENT_KEYS } from '../domain/enums'
import type { MealType } from '../domain/enums'
import type { Food, NutrientProfile, Recipe, RecipeIngredient, ServingDefinition } from '../domain/models'
import { NutritionRepository } from '../db/repositories'
import { ensureNutritionSeed } from '../seed/seedService'
import { MealService } from '../services/MealService'
import { formatNutrition } from '../services/NutritionCalculationService'
import { RecipeService, type RecipeInput } from '../services/RecipeService'
import { reportTechnicalError } from '../utils/technicalError'

interface FoodPickerSheetProps { open: boolean; userId: string; localDate: string; mealType: MealType; onClose: () => void }
type PickerView = 'all' | 'recent' | 'favorites' | 'recipes'
type Selection = { kind: 'FOOD'; item: Food } | { kind: 'RECIPE'; item: Recipe }

const repository = new NutritionRepository()
const mealService = new MealService()
const recipeService = new RecipeService()
const emptyNutrients = (): NutrientProfile => Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, null])) as NutrientProfile

export function FoodPickerSheet({ open, userId, localDate, mealType, onClose }: FoodPickerSheetProps) {
  const [view, setView] = useState<PickerView>('all')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<Selection>()
  const [editor, setEditor] = useState<'food' | 'recipe'>()
  const [editingFood, setEditingFood] = useState<Food>()
  const [editingRecipeId, setEditingRecipeId] = useState<string>()
  const [error, setError] = useState<string>()
  const [seedReady, setSeedReady] = useState(false)

  useEffect(() => {
    if (!open) return
    setView('all'); setQuery(''); setSelection(undefined); setEditor(undefined); setEditingFood(undefined); setEditingRecipeId(undefined); setError(undefined); setSeedReady(false)
    let active = true
    void ensureNutritionSeed().then(() => { if (active) setSeedReady(true) }).catch((cause) => { reportTechnicalError('Nutrition seed prepare', cause); if (active) setError('Gıda verileri hazırlanamadı.') })
    return () => { active = false }
  }, [open, mealType])
  const results = useLiveQuery(async () => {
    if (!open || !userId || !seedReady) return [] as Selection[]
    if (view === 'recent') {
      const recent = await mealService.recent(userId, 12)
      const items = await Promise.all(recent.map(async (entry): Promise<Selection | undefined> => entry.foodId
        ? repository.getFood(entry.foodId, userId).then((item) => item ? { kind: 'FOOD', item } : undefined)
        : repository.getRecipe(entry.recipeId!, userId).then((item) => item ? { kind: 'RECIPE', item } : undefined)))
      return items.filter((item): item is Selection => Boolean(item))
    }
    if (view === 'favorites') {
      const favorites = await repository.listFavorites(userId)
      const items = await Promise.all(favorites.map(async (favorite): Promise<Selection | undefined> => favorite.itemType === 'FOOD'
        ? repository.getFood(favorite.itemId, userId).then((item) => item ? { kind: 'FOOD', item } : undefined)
        : repository.getRecipe(favorite.itemId, userId).then((item) => item ? { kind: 'RECIPE', item } : undefined)))
      return items.filter((item): item is Selection => Boolean(item))
    }
    const [foods, recipes] = await Promise.all([
      view === 'recipes' ? Promise.resolve([]) : repository.searchFoods(userId, { query, limit: 40 }),
      repository.listRecipes(userId, query),
    ])
    return [...foods.map((item): Selection => ({ kind: 'FOOD', item })), ...recipes.slice(0, view === 'recipes' ? 60 : 20).map((item): Selection => ({ kind: 'RECIPE', item }))]
  }, [open, userId, seedReady, view, query], [])
  const favorites = useLiveQuery(() => open && userId ? repository.listFavorites(userId) : [], [open, userId], [])
  const favoriteKeys = useMemo(() => new Set(favorites.map((favorite) => `${favorite.itemType}:${favorite.itemId}`)), [favorites])

  if (!open) return null
  const title = editor === 'food' ? (editingFood ? 'Gıdayı düzenle' : 'Gıda oluştur') : editor === 'recipe' ? (editingRecipeId ? 'Tarifi düzenle' : 'Tarif oluştur') : selection ? selection.item.name : 'Öğüne ekle'
  const goBack = () => { if (editor) { setEditor(undefined); setEditingFood(undefined); setEditingRecipeId(undefined) } else if (selection) setSelection(undefined); else onClose() }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="measurement-sheet food-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="food-picker-title">
      <header><button className="icon-button" aria-label="Geri" onClick={goBack}><ChevronLeft size={21} /></button><h2 id="food-picker-title">{title}</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header>
      {editor === 'food' ? <CustomFoodEditor userId={userId} initial={editingFood} onSaved={(food) => { setEditor(undefined); setEditingFood(undefined); setSelection({ kind: 'FOOD', item: food }) }} />
        : editor === 'recipe' ? <RecipeEditor userId={userId} recipeId={editingRecipeId} onSaved={(recipe) => { setEditor(undefined); setEditingRecipeId(undefined); setSelection({ kind: 'RECIPE', item: recipe }) }} />
        : selection ? <SelectionDetail selection={selection} userId={userId} localDate={localDate} mealType={mealType} favorite={favoriteKeys.has(`${selection.kind}:${selection.item.id}`)} onFavorite={() => void repository.toggleFavorite(userId, selection.kind, selection.item.id)} onEdit={selection.item.userId === userId ? () => { if (selection.kind === 'FOOD') setEditingFood(selection.item); else setEditingRecipeId(selection.item.id); setEditor(selection.kind === 'FOOD' ? 'food' : 'recipe') } : undefined} onDelete={selection.item.userId === userId ? async () => { if (!window.confirm('Bu kaydı silmek istediğine emin misin?')) return; if (selection.kind === 'FOOD') await repository.deleteCustomFood(userId, selection.item.id); else await recipeService.delete(userId, selection.item.id); setSelection(undefined) } : undefined} onAdded={onClose} />
        : <>
          <label className="food-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Yumurta, yoğurt, mercimek..." /></label>
          <div className="food-picker-tabs" role="tablist" aria-label="Gıda görünümü">{([['all', 'Tümü'], ['recent', 'Son'], ['favorites', 'Favori'], ['recipes', 'Tarif']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>)}</div>
          <div className="food-create-row"><button onClick={() => setEditor('food')}><Plus size={17} /> Gıda</button><button onClick={() => setEditor('recipe')}><Plus size={17} /> Tarif</button></div>
          {error && <p className="form-error">{error}</p>}
          <div className="food-result-list">{!seedReady || results === undefined ? <div className="nutrition-sheet-loading"><LoaderCircle className="spin" size={24} /></div> : results.length ? results.map((result) => <button key={`${result.kind}:${result.item.id}`} onClick={() => setSelection(result)}><span className="food-result-icon">{result.kind === 'FOOD' ? result.item.name.slice(0, 1) : 'T'}</span><div><strong>{result.item.name}</strong><small>{result.kind === 'FOOD' ? `${formatNutrition.kcal(result.item.nutrientsPer100g.energyKcal)} kcal / 100 g` : `${result.item.servings} porsiyon · Tarif`}</small></div>{favoriteKeys.has(`${result.kind}:${result.item.id}`) && <Star size={16} fill="currentColor" />}</button>) : <div className="food-empty"><Search size={24} /><strong>Sonuç bulunamadı</strong><span>Farklı bir ad dene veya kendi kaydını ekle.</span></div>}</div>
        </>}
    </section>
  </div>
}

function SelectionDetail({ selection, userId, localDate, mealType, favorite, onFavorite, onEdit, onDelete, onAdded }: { selection: Selection; userId: string; localDate: string; mealType: MealType; favorite: boolean; onFavorite: () => void; onEdit?: () => void; onDelete?: () => Promise<void>; onAdded: () => void }) {
  const [mode, setMode] = useState<'grams' | 'serving'>(selection.kind === 'FOOD' && selection.item.servingDefinitions.length ? 'serving' : selection.kind === 'RECIPE' ? 'serving' : 'grams')
  const [amount, setAmount] = useState(selection.kind === 'FOOD' && !selection.item.servingDefinitions.length ? '100' : '1')
  const [servingId, setServingId] = useState(selection.kind === 'FOOD' ? selection.item.servingDefinitions[0]?.id ?? '' : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const detail = useLiveQuery(() => selection.kind === 'RECIPE' ? recipeService.detail(userId, selection.item.id) : undefined, [selection.kind, selection.item.id, userId])
  const selectedServing: ServingDefinition | undefined = selection.kind === 'FOOD' ? selection.item.servingDefinitions.find((serving) => serving.id === servingId) : undefined
  const grams = selection.kind === 'FOOD' ? (mode === 'serving' ? Number(amount) * (selectedServing?.grams ?? 0) : Number(amount)) : Number(amount)
  const energy = selection.kind === 'FOOD' ? selection.item.nutrientsPer100g.energyKcal === null ? null : selection.item.nutrientsPer100g.energyKcal * grams / 100 : detail?.calculation.perServing.nutrients.energyKcal === null || detail?.calculation.perServing.nutrients.energyKcal === undefined ? null : detail.calculation.perServing.nutrients.energyKcal * Number(amount)

  const add = async () => {
    setSaving(true); setError(undefined)
    try {
      if (selection.kind === 'FOOD') await mealService.addFood(userId, localDate, mealType, selection.item.id, grams, mode === 'serving' && selectedServing ? { ...selectedServing, label: `${amount} × ${selectedServing.label}` } : undefined)
      else await mealService.addRecipe(userId, localDate, mealType, selection.item.id, mode === 'grams' ? { grams: Number(amount) } : { servings: Number(amount) })
      onAdded()
    } catch (cause) { reportTechnicalError('Meal item add', cause); setError('Miktarı kontrol edip tekrar dene.') }
    finally { setSaving(false) }
  }

  const canUseGrams = selection.kind === 'FOOD' || Boolean(detail?.recipe.totalCookedWeightG)
  return <div className="food-detail">
    <div className="food-detail-heading"><div><span>{selection.kind === 'FOOD' ? 'GIDA' : 'TARİF'}</span><strong>{selection.item.name}</strong><small>{selection.kind === 'FOOD' ? selection.item.verificationStatus === 'VERIFIED' ? `${selection.item.sourceType} · ${selection.item.sourceRelease ?? 'Doğrulanmış'}` : 'Kullanıcı kaydı' : `${selection.item.servings} porsiyon · v${selection.item.recipeVersion}`}</small></div><button aria-label={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'} title={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'} onClick={onFavorite}><Heart size={20} fill={favorite ? 'currentColor' : 'none'} /></button>{onEdit && <button aria-label="Kaydı düzenle" title="Düzenle" onClick={onEdit}><Pencil size={19} /></button>}</div>
    {onDelete && <button className="danger-text-button food-delete-command" onClick={() => void onDelete()}><Trash2 size={16} /> Kaydı sil</button>}
    {selection.kind === 'RECIPE' && detail && <div className="recipe-ingredients"><span>İçindekiler</span>{detail.ingredients.map(({ ingredient, food }) => <small key={ingredient.id}>{food.name} · {formatNutrition.grams(ingredient.amountG)} g</small>)}</div>}
    <div className="amount-mode"><button className={mode === 'serving' ? 'active' : ''} onClick={() => { setMode('serving'); setAmount('1') }}>Porsiyon</button><button className={mode === 'grams' ? 'active' : ''} disabled={!canUseGrams} onClick={() => { setMode('grams'); setAmount('100') }}>Gram</button></div>
    {mode === 'serving' && selection.kind === 'FOOD' && <label className="nutrition-field"><span>Porsiyon</span><select value={servingId} onChange={(event) => setServingId(event.target.value)}>{selection.item.servingDefinitions.map((serving) => <option key={serving.id} value={serving.id}>{serving.label} ({formatNutrition.grams(serving.grams)} g)</option>)}</select></label>}
    <label className="nutrition-amount"><span>{mode === 'grams' ? 'Miktar' : 'Adet / porsiyon'}</span><div><input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><b>{mode === 'grams' ? 'g' : 'x'}</b></div></label>
    {!canUseGrams && <p className="nutrition-note">Bu tarifte pişmiş verim kaydı yok; porsiyonla eklenebilir.</p>}
    <div className="food-detail-preview"><span>Yaklaşık enerji</span><strong>{formatNutrition.kcal(energy)} kcal</strong></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={saving || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || (mode === 'serving' && selection.kind === 'FOOD' && !selectedServing)} onClick={() => void add()}>{saving ? <><LoaderCircle className="spin" size={18} /> Ekleniyor</> : 'Öğüne Ekle'}</button>
  </div>
}

function CustomFoodEditor({ userId, initial, onSaved }: { userId: string; initial?: Food; onSaved: (food: Food) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [servingG, setServingG] = useState(initial?.servingDefinitions[0]?.grams.toString() ?? '')
  const [nutrients, setNutrients] = useState({ energyKcal: initial?.nutrientsPer100g.energyKcal?.toString() ?? '', proteinG: initial?.nutrientsPer100g.proteinG?.toString() ?? '', carbohydrateG: initial?.nutrientsPer100g.carbohydrateG?.toString() ?? '', fatG: initial?.nutrientsPer100g.fatG?.toString() ?? '', fiberG: initial?.nutrientsPer100g.fiberG?.toString() ?? '', sodiumMg: initial?.nutrientsPer100g.sodiumMg?.toString() ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(undefined)
    try {
      const profile = emptyNutrients()
      for (const key of Object.keys(nutrients) as Array<keyof typeof nutrients>) profile[key] = nutrients[key] === '' ? null : Number(nutrients[key])
      const servingDefinitions: ServingDefinition[] = servingG ? [{ id: crypto.randomUUID(), label: '1 porsiyon', grams: Number(servingG), source: 'USER_DEFINED' }] : []
      const food = await repository.saveCustomFood(userId, { id: initial?.id, name, aliases: initial?.aliases ?? [], category: initial?.category ?? 'other', servingDefinitions, nutrientsPer100g: profile, preparationState: initial?.preparationState ?? 'as_sold' })
      onSaved(food)
    } catch (cause) { reportTechnicalError('Custom food save', cause); setError('Zorunlu alanları ve değerleri kontrol et.') }
    finally { setSaving(false) }
  }
  return <form className="nutrition-editor" onSubmit={save}><label className="nutrition-field"><span>Gıda adı</span><input autoFocus required maxLength={140} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ev yapımı granola" /></label><label className="nutrition-field"><span>Porsiyon gramı <small>isteğe bağlı</small></span><input type="number" min="0.1" step="0.1" value={servingG} onChange={(event) => setServingG(event.target.value)} placeholder="45" /></label><p>Besin değerlerini 100 gram için gir.</p><div className="nutrition-editor-grid">{([['energyKcal', 'Enerji', 'kcal'], ['proteinG', 'Protein', 'g'], ['carbohydrateG', 'Karbonhidrat', 'g'], ['fatG', 'Yağ', 'g'], ['fiberG', 'Lif', 'g'], ['sodiumMg', 'Sodyum', 'mg']] as const).map(([key, label, unit]) => <label key={key}><span>{label}</span><div><input type="number" min="0" step="0.01" value={nutrients[key]} onChange={(event) => setNutrients((current) => ({ ...current, [key]: event.target.value }))} placeholder="Bilinmiyor" /><b>{unit}</b></div></label>)}</div>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : initial ? 'Değişiklikleri Kaydet' : 'Gıdayı Kaydet'}</button></form>
}

interface DraftIngredient { food: Food; amountG: string; preparationState?: RecipeIngredient['preparationState'] }
function RecipeEditor({ userId, recipeId, onSaved }: { userId: string; recipeId?: string; onSaved: (recipe: Recipe) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [preparation, setPreparation] = useState('')
  const [servings, setServings] = useState('4')
  const [yieldG, setYieldG] = useState('')
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const foods = useLiveQuery(() => query.trim().length >= 2 ? repository.searchFoods(userId, { query, limit: 8 }) : [], [query, userId], [])
  useEffect(() => {
    if (!recipeId) return
    void recipeService.detail(userId, recipeId).then((detail) => {
      if (!detail) return
      setName(detail.recipe.name); setDescription(detail.recipe.description); setPreparation(detail.recipe.preparation); setServings(String(detail.recipe.servings)); setYieldG(detail.recipe.totalCookedWeightG?.toString() ?? '')
      setIngredients(detail.ingredients.map(({ food, ingredient }) => ({ food, amountG: String(ingredient.amountG), preparationState: ingredient.preparationState })))
    }).catch((cause) => { reportTechnicalError('Recipe editor load', cause); setError('Tarif açılamadı.') })
  }, [recipeId, userId])
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(undefined)
    try {
      const input: RecipeInput = { name, description, preparation, category: 'main_dish', servings: Number(servings), totalCookedWeightG: yieldG ? Number(yieldG) : undefined, ingredients: ingredients.map((entry) => ({ foodId: entry.food.id, amountG: Number(entry.amountG), preparationState: entry.preparationState })) }
      const result = recipeId ? await recipeService.edit(userId, recipeId, input) : await recipeService.create(userId, input)
      onSaved(result.recipe)
    } catch (cause) { reportTechnicalError('Recipe save', cause); setError('Tarif, porsiyon ve malzeme miktarlarını kontrol et.') }
    finally { setSaving(false) }
  }
  return <form className="nutrition-editor recipe-editor" onSubmit={save}><label className="nutrition-field"><span>Tarif adı</span><input autoFocus required maxLength={140} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="recipe-meta-grid"><label className="nutrition-field"><span>Porsiyon</span><input required type="number" min="1" step="1" value={servings} onChange={(event) => setServings(event.target.value)} /></label><label className="nutrition-field"><span>Pişmiş toplam <small>isteğe bağlı</small></span><input type="number" min="1" step="0.1" value={yieldG} onChange={(event) => setYieldG(event.target.value)} placeholder="gram" /></label></div><label className="nutrition-field"><span>Kısa açıklama</span><input required maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="nutrition-field"><span>Hazırlama</span><textarea required maxLength={600} rows={3} value={preparation} onChange={(event) => setPreparation(event.target.value)} /></label><div className="recipe-builder"><span>Malzemeler</span><label className="food-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Malzeme ara" /></label>{query.trim().length >= 2 && <div className="ingredient-results">{foods.map((food) => <button type="button" key={food.id} onClick={() => { if (!ingredients.some((entry) => entry.food.id === food.id)) setIngredients((current) => [...current, { food, amountG: '100' }]); setQuery('') }}><Plus size={15} /> {food.name}</button>)}</div>}<div className="draft-ingredients">{ingredients.map((entry) => <div key={entry.food.id}><span>{entry.food.name}</span><label><input required type="number" min="0.1" step="0.1" value={entry.amountG} onChange={(event) => setIngredients((current) => current.map((item) => item.food.id === entry.food.id ? { ...item, amountG: event.target.value } : item))} /><b>g</b></label><button type="button" aria-label={`${entry.food.name} malzemesini çıkar`} onClick={() => setIngredients((current) => current.filter((item) => item.food.id !== entry.food.id))}><X size={16} /></button></div>)}</div></div>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving || !ingredients.length}>{saving ? <LoaderCircle className="spin" size={18} /> : recipeId ? 'Yeni Sürümü Kaydet' : 'Tarifi Kaydet'}</button></form>
}
