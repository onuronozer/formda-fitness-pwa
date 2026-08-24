import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const foundationPath = process.argv[2]
const legacyPath = process.argv[3]
if (!foundationPath || !legacyPath) throw new Error('Usage: node scripts/build-food-seed.mjs <foundation-json> <sr-legacy-json>')

const curated = [
  ['f', 748967, 'Yumurta (bütün)', ['yumurta', 'tavuk yumurtası'], 'egg', 'raw'],
  ['f', 747997, 'Yumurta beyazı', ['yumurta akı'], 'egg', 'raw'],
  ['f', 748236, 'Yumurta sarısı', [], 'egg', 'raw'],
  ['f', 2259796, 'Feta peyniri', ['feta'], 'dairy_cheese', 'as_sold'],
  ['f', 328637, 'Cheddar peyniri', ['cheddar'], 'dairy_cheese', 'as_sold'],
  ['f', 328841, 'Cottage peyniri (%2 yağlı)', ['cottage cheese'], 'dairy_cheese', 'as_sold'],
  ['f', 2346384, 'Cottage peyniri (tam yağlı)', [], 'dairy_cheese', 'as_sold'],
  ['f', 746766, 'Ricotta peyniri', ['ricotta'], 'dairy_cheese', 'as_sold'],
  ['f', 329370, 'Mozzarella (az yağlı)', ['mozzarella'], 'dairy_cheese', 'as_sold'],
  ['f', 2259793, 'Yoğurt (tam yağlı, sade)', ['yoğurt', 'yogurt'], 'dairy_cheese', 'as_sold'],
  ['f', 2259794, 'Süzme yoğurt (tam yağlı, sade)', ['greek yogurt', 'süzme yoğurt'], 'dairy_cheese', 'as_sold'],
  ['f', 746782, 'Süt (tam yağlı)', ['süt'], 'dairy_cheese', 'as_sold'],
  ['f', 746778, 'Süt (%2 yağlı)', [], 'dairy_cheese', 'as_sold'],
  ['s', 173410, 'Tereyağı (tuzlu)', ['tereyağı'], 'sauce_fat', 'as_sold'],
  ['f', 2346396, 'Yulaf ezmesi', ['yulaf'], 'bread_grain', 'raw'],
  ['f', 2346397, 'Kesilmiş yulaf', ['steel cut oats'], 'bread_grain', 'raw'],
  ['f', 2710820, 'Bulgur (kuru)', ['bulgur'], 'rice_bulgur', 'raw'],
  ['f', 2512381, 'Beyaz pirinç (kuru)', ['pirinç'], 'rice_bulgur', 'raw'],
  ['f', 2512380, 'Esmer pirinç (kuru)', [], 'rice_bulgur', 'raw'],
  ['f', 2710825, 'Siyah pirinç (kuru)', [], 'rice_bulgur', 'raw'],
  ['f', 2710821, 'Yabani pirinç (kuru)', [], 'rice_bulgur', 'raw'],
  ['f', 2512378, 'Karabuğday (tam tane)', ['karabuğday'], 'bread_grain', 'raw'],
  ['f', 2512379, 'Darı (tam tane)', ['darı'], 'bread_grain', 'raw'],
  ['f', 2710828, 'Farro (kuru)', [], 'bread_grain', 'raw'],
  ['f', 790085, 'Tam buğday unu', [], 'bread_grain', 'raw'],
  ['f', 789951, 'Buğday unu', ['un'], 'bread_grain', 'raw'],
  ['f', 2003588, 'İrmik (kaba)', ['irmik'], 'bread_grain', 'raw'],
  ['s', 172688, 'Tam buğday ekmeği', ['kepekli ekmek'], 'bread_grain', 'as_sold'],
  ['s', 174924, 'Beyaz ekmek', ['ekmek'], 'bread_grain', 'as_sold'],
  ['s', 168928, 'Makarna (pişmiş, tuzsuz)', ['makarna'], 'pasta', 'cooked'],
  ['f', 2644283, 'Mercimek (kuru)', ['mercimek'], 'legume', 'raw'],
  ['s', 172421, 'Mercimek (pişmiş, tuzsuz)', [], 'legume', 'cooked'],
  ['f', 2644282, 'Nohut (kuru)', ['nohut'], 'legume', 'raw'],
  ['s', 173757, 'Nohut (pişmiş, tuzsuz)', [], 'legume', 'cooked'],
  ['f', 2644281, 'Cannellini fasulyesi (kuru)', ['kuru fasulye'], 'legume', 'raw'],
  ['f', 2644287, 'Cannellini fasulyesi (konserve, süzülmüş)', [], 'legume', 'drained'],
  ['s', 173740, 'Kırmızı barbunya (pişmiş, tuzsuz)', ['barbunya'], 'legume', 'cooked'],
  ['f', 2644292, 'Pinto fasulyesi (konserve, süzülmüş)', [], 'legume', 'drained'],
  ['f', 2644284, 'Börülce (kuru)', ['börülce'], 'legume', 'raw'],
  ['f', 2644293, 'Börülce (konserve, süzülmüş)', [], 'legume', 'drained'],
  ['f', 2644285, 'Siyah fasulye (konserve, süzülmüş)', [], 'legume', 'drained'],
  ['f', 321358, 'Humus (hazır)', ['humus'], 'legume', 'prepared'],
  ['f', 2646170, 'Tavuk göğsü (çiğ, derisiz)', ['tavuk göğsü'], 'chicken', 'raw'],
  ['f', 331960, 'Tavuk göğsü (pişmiş, derisiz)', [], 'chicken', 'cooked'],
  ['f', 2646171, 'Tavuk but (çiğ, derisiz)', ['tavuk but'], 'chicken', 'raw'],
  ['f', 331897, 'Tavuk baget eti (pişmiş)', [], 'chicken', 'cooked'],
  ['f', 2514743, 'Dana kıyma (%10 yağlı, çiğ)', ['kıyma'], 'meat', 'raw'],
  ['f', 2514744, 'Dana kıyma (%20 yağlı, çiğ)', [], 'meat', 'raw'],
  ['f', 746761, 'Dana nuar (yağsız, çiğ)', ['dana eti'], 'meat', 'raw'],
  ['f', 2646175, 'Dana flank biftek (çiğ)', ['biftek'], 'meat', 'raw'],
  ['f', 2727573, 'Dana bonfile (çiğ)', ['bonfile'], 'meat', 'raw'],
  ['f', 2727570, 'Kuzu kıyma (çiğ)', ['kuzu eti'], 'meat', 'raw'],
  ['f', 2646169, 'Domuz bonfile (çiğ)', [], 'meat', 'raw'],
  ['f', 2514747, 'Hindi kıyma (%7 yağlı, çiğ)', ['hindi'], 'meat', 'raw'],
  ['f', 2684441, 'Atlantik somonu (çiftlik, çiğ)', ['somon'], 'fish', 'raw'],
  ['f', 2684440, 'Sockeye somonu (yabani, çiğ)', [], 'fish', 'raw'],
  ['f', 334194, 'Ton balığı (suda konserve, süzülmüş)', ['ton balığı'], 'fish', 'drained'],
  ['f', 2684444, 'Atlantik morinası (çiğ)', ['morina'], 'fish', 'raw'],
  ['f', 2684443, 'Karides (çiğ)', ['karides'], 'fish', 'raw'],
  ['f', 2747652, 'Hamsi/ançüez (zeytinyağında konserve, süzülmüş)', ['ançüez'], 'fish', 'drained'],
  ['f', 2684442, 'Tilapia (çiğ)', [], 'fish', 'raw'],
  ['f', 1999634, 'Roma domatesi (çiğ)', ['domates'], 'vegetable', 'raw'],
  ['f', 321360, 'Üzüm domates (çiğ)', [], 'vegetable', 'raw'],
  ['f', 2346406, 'Salatalık (kabuklu, çiğ)', ['salatalık'], 'vegetable', 'raw'],
  ['f', 790646, 'Sarı soğan (çiğ)', ['soğan'], 'vegetable', 'raw'],
  ['f', 790577, 'Kırmızı soğan (çiğ)', [], 'vegetable', 'raw'],
  ['f', 1104647, 'Sarımsak (çiğ)', ['sarımsak'], 'vegetable', 'raw'],
  ['f', 2258590, 'Kırmızı kapya biber (çiğ)', ['kırmızı biber'], 'vegetable', 'raw'],
  ['f', 2258588, 'Yeşil dolmalık biber (çiğ)', ['yeşil biber'], 'vegetable', 'raw'],
  ['f', 2685577, 'Patlıcan (çiğ)', ['patlıcan'], 'vegetable', 'raw'],
  ['f', 2685568, 'Kabak (çiğ, kabuklu)', ['kabak'], 'vegetable', 'raw'],
  ['f', 2346401, 'Patates (çiğ, kabuksuz)', ['patates'], 'vegetable', 'raw'],
  ['f', 2346404, 'Tatlı patates (çiğ, kabuksuz)', [], 'vegetable', 'raw'],
  ['f', 2258586, 'Havuç (çiğ)', ['havuç'], 'vegetable', 'raw'],
  ['f', 2346400, 'Taze fasulye (çiğ)', ['yeşil fasulye'], 'vegetable', 'raw'],
  ['f', 747447, 'Brokoli (çiğ)', ['brokoli'], 'vegetable', 'raw'],
  ['f', 2685573, 'Karnabahar (çiğ)', ['karnabahar'], 'vegetable', 'raw'],
  ['f', 2346407, 'Beyaz lahana (çiğ)', ['lahana'], 'vegetable', 'raw'],
  ['f', 1999633, 'Ispanak (çiğ)', ['ıspanak'], 'vegetable', 'raw'],
  ['f', 323505, 'Kale (çiğ)', [], 'vegetable', 'raw'],
  ['f', 746769, 'Marul (romen, çiğ)', ['marul'], 'vegetable', 'raw'],
  ['f', 2346388, 'Göbek marul (çiğ)', [], 'vegetable', 'raw'],
  ['f', 2685576, 'Pancar (çiğ)', ['pancar'], 'vegetable', 'raw'],
  ['f', 2747665, 'Kırmızı turp (çiğ)', ['turp'], 'vegetable', 'raw'],
  ['f', 2710822, 'Roka (çiğ)', ['roka'], 'vegetable', 'raw'],
  ['f', 2710826, 'Tatlı mısır tanesi (çiğ)', ['mısır'], 'vegetable', 'raw'],
  ['f', 1105314, 'Muz (olgun, çiğ)', ['muz'], 'fruit', 'raw'],
  ['f', 1750341, 'Elma (Gala, kabuklu)', ['elma'], 'fruit', 'raw'],
  ['f', 746771, 'Portakal (navel, çiğ)', ['portakal'], 'fruit', 'raw'],
  ['f', 2710836, 'Armut (Anjou, kabuklu)', ['armut'], 'fruit', 'raw'],
  ['f', 2346409, 'Çilek (çiğ)', ['çilek'], 'fruit', 'raw'],
  ['f', 2346411, 'Yaban mersini (çiğ)', [], 'fruit', 'raw'],
  ['f', 2346410, 'Ahududu (çiğ)', [], 'fruit', 'raw'],
  ['s', 173946, 'Böğürtlen (çiğ)', [], 'fruit', 'raw'],
  ['f', 2346413, 'Yeşil üzüm (çekirdeksiz, çiğ)', ['üzüm'], 'fruit', 'raw'],
  ['f', 2346398, 'Ananas (çiğ)', ['ananas'], 'fruit', 'raw'],
  ['f', 2710834, 'Mango (çiğ)', ['mango'], 'fruit', 'raw'],
  ['f', 2710831, 'Kivi (soyulmuş, çiğ)', ['kivi'], 'fruit', 'raw'],
  ['f', 2710815, 'Kayısı (kabuklu, çiğ)', ['kayısı'], 'fruit', 'raw'],
  ['f', 325430, 'Şeftali (çiğ)', ['şeftali'], 'fruit', 'raw'],
  ['f', 746770, 'Kavun (çiğ)', ['kavun'], 'fruit', 'raw'],
  ['s', 167765, 'Karpuz (çiğ)', ['karpuz'], 'fruit', 'raw'],
  ['f', 2346393, 'Badem (çiğ)', ['badem'], 'nuts', 'raw'],
  ['f', 2346394, 'Ceviz (çiğ)', ['ceviz'], 'nuts', 'raw'],
  ['f', 2515375, 'Fındık (çiğ)', ['fındık'], 'nuts', 'raw'],
  ['f', 2515374, 'Kaju (çiğ)', ['kaju'], 'nuts', 'raw'],
  ['f', 2515379, 'Antep fıstığı (çiğ)', ['fıstık'], 'nuts', 'raw'],
  ['f', 2515376, 'Yer fıstığı (çiğ)', [], 'nuts', 'raw'],
  ['f', 2515380, 'Kabak çekirdeği içi (çiğ)', [], 'nuts', 'raw'],
  ['f', 2515381, 'Ay çekirdeği içi (çiğ)', [], 'nuts', 'raw'],
  ['f', 2710819, 'Chia tohumu (kuru)', ['chia'], 'nuts', 'raw'],
  ['f', 2262075, 'Öğütülmüş keten tohumu', ['keten tohumu'], 'nuts', 'raw'],
  ['s', 171413, 'Zeytinyağı', ['zeytinyağı'], 'sauce_fat', 'as_sold'],
  ['s', 171025, 'Ayçiçek yağı (linoleik yaklaşık %65)', ['ayçiçek yağı'], 'sauce_fat', 'as_sold'],
  ['s', 173430, 'Tereyağı (tuzsuz)', [], 'sauce_fat', 'as_sold'],
  ['f', 2685580, 'Domates salçası (tuzsuz)', ['salça'], 'sauce_fat', 'prepared'],
  ['s', 173468, 'Sofra tuzu', ['tuz'], 'sauce_fat', 'as_sold'],
  ['f', 2259792, 'Buttermilk (az yağlı)', [], 'beverage', 'as_sold'],
  ['f', 1999630, 'Soya sütü (şekersiz)', [], 'beverage', 'as_sold'],
  ['f', 2257045, 'Badem sütü (şekersiz)', [], 'beverage', 'as_sold'],
  ['f', 2003597, 'Portakal suyu', [], 'beverage', 'as_sold'],
  ['f', 746784, 'Toz şeker', ['şeker'], 'dessert', 'as_sold'],
]

const foundation = JSON.parse(readFileSync(foundationPath, 'utf8')).FoundationFoods
const records = new Map(foundation.filter(Boolean).map((food) => [food.fdcId, food]))
const legacyIds = new Set(curated.filter(([source]) => source === 's').map(([, id]) => id))
if (legacyIds.size) {
  const lines = createInterface({ input: createReadStream(legacyPath), crlfDelay: Infinity })
  for await (let line of lines) {
    line = line.trim().replace(/,$/, '')
    if (!line.includes('foodClass')) continue
    try { const food = JSON.parse(line); if (legacyIds.has(food.fdcId)) records.set(food.fdcId, food) } catch { /* final wrapper line */ }
  }
}

const nutrient = (food, ids) => {
  for (const id of ids) {
    const value = food.foodNutrients.find((item) => item.nutrient?.id === id)?.amount
    if (typeof value === 'number' && Number.isFinite(value)) return value >= 0 ? value : null
  }
  return null
}
const nutrientProfile = (food) => ({
  energyKcal: nutrient(food, [1008, 2048, 2047]), proteinG: nutrient(food, [1003]), carbohydrateG: nutrient(food, [1005, 1050]), fatG: nutrient(food, [1004]),
  fiberG: nutrient(food, [1079]), sugarG: nutrient(food, [1063, 2000]), saturatedFatG: nutrient(food, [1258]), sodiumMg: nutrient(food, [1093]),
  potassiumMg: nutrient(food, [1092]), calciumMg: nutrient(food, [1087]), ironMg: nutrient(food, [1089]), cholesterolMg: nutrient(food, [1253]),
})
const portionLabel = (portion) => {
  const unit = `${portion.measureUnit?.name ?? ''} ${portion.modifier ?? ''}`.toLowerCase()
  if (unit.includes('egg')) return '1 adet'
  if (unit.includes('slice')) return '1 dilim'
  if (unit.includes('cup')) return '1 bardak'
  if (unit.includes('tablespoon')) return '1 yemek kaşığı'
  if (unit.includes('teaspoon')) return '1 tatlı kaşığı'
  return undefined
}
const stamp = '2026-04-30T00:00:00.000Z'
const foodSeed = curated.map(([source, id, name, aliases, category, preparationState]) => {
  const food = records.get(id)
  if (!food) throw new Error(`Missing FDC record ${id}`)
  const servingDefinitions = (food.foodPortions ?? []).map((portion) => {
    const label = portionLabel(portion)
    return label && Number.isFinite(portion.gramWeight) && portion.gramWeight > 0 ? { id: `fdc-portion-${portion.id}`, label, grams: portion.gramWeight, source: 'USDA_PORTION', sourceId: String(portion.id) } : undefined
  }).filter(Boolean)
  return {
    id: `food-usda-fdc-${id}`, createdAt: stamp, updatedAt: stamp, version: 1, schemaVersion: 7, name, normalizedName: '', aliases, category,
    sourceType: 'USDA_FDC', sourceId: String(id), sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${id}/nutrients`,
    sourceRelease: source === 'f' ? 'Foundation Foods 04/2026' : 'SR Legacy 04/2018', sourceDescription: food.description,
    verificationStatus: 'VERIFIED', dataVersion: 3, servingDefinitions, nutrientsPer100g: nutrientProfile(food), preparationState, active: true,
  }
})

const normalize = (value) => value.trim().toLocaleLowerCase('tr-TR').replace(/[ıiİ]/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
foodSeed.forEach((food) => { food.normalizedName = normalize(food.name) })
const output = `import type { Food } from '../domain/models'\n\nexport const foodSeed: Food[] = ${JSON.stringify(foodSeed, null, 2)}\n`
writeFileSync(resolve('src/seed/foodSeed.generated.ts'), output)
process.stdout.write(`Generated ${foodSeed.length} verified USDA foods.\n`)
