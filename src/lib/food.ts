export interface FoodHit {
  id: string
  name: string
  brand?: string
  source: 'USDA' | 'OFF'
  per100: { kcal: number; protein: number; carbs: number; fat: number }
  servingG?: number
  servingLabel?: string
}

const r1 = (n: number) => Math.round(n * 10) / 10

interface UsdaNutrient { nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number }
interface UsdaFood {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  dataType?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaNutrient[]
}

function usdaNutrient(list: UsdaNutrient[], num: string, fallbackName?: string) {
  const n = list.find((x) => x.nutrientNumber === num) ?? (fallbackName ? list.find((x) => x.nutrientName === fallbackName && x.unitName === 'KCAL') : undefined)
  return n?.value ?? 0
}

export async function searchUSDA(query: string, apiKey: string): Promise<FoodHit[]> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', '20')
  url.searchParams.set('api_key', apiKey || 'DEMO_KEY')
  url.searchParams.append('dataType', 'Foundation')
  url.searchParams.append('dataType', 'SR Legacy')
  url.searchParams.append('dataType', 'Survey (FNDDS)')
  url.searchParams.append('dataType', 'Branded')
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.status === 429 ? 'USDA rate limit hit. Add your own free API key in Settings.' : `USDA error ${res.status}`)
  const data = (await res.json()) as { foods?: UsdaFood[] }
  return (data.foods ?? []).map((f) => {
    const n = f.foodNutrients ?? []
    const g = f.servingSizeUnit && /^g|grm$/i.test(f.servingSizeUnit) ? f.servingSize : undefined
    return {
      id: `usda-${f.fdcId}`,
      name: titleCase(f.description),
      brand: f.brandName || f.brandOwner,
      source: 'USDA' as const,
      per100: {
        kcal: Math.round(usdaNutrient(n, '208', 'Energy') || usdaNutrient(n, '957') || usdaNutrient(n, '958')),
        protein: r1(usdaNutrient(n, '203')),
        carbs: r1(usdaNutrient(n, '205')),
        fat: r1(usdaNutrient(n, '204')),
      },
      servingG: g ? Math.round(g) : undefined,
      servingLabel: f.householdServingFullText,
    }
  }).filter((h) => h.per100.kcal > 0 || h.per100.protein > 0)
}

interface OffProduct {
  code?: string
  product_name?: string
  brands?: string
  serving_quantity?: number | string
  serving_size?: string
  nutriments?: Record<string, number | string>
}

function offToHit(p: OffProduct): FoodHit | null {
  const n = p.nutriments ?? {}
  const num = (k: string) => Number(n[k] ?? 0) || 0
  const kcal = num('energy-kcal_100g') || num('energy_100g') / 4.184
  if (!p.product_name || !kcal) return null
  const sq = Number(p.serving_quantity)
  return {
    id: `off-${p.code}`,
    name: p.product_name,
    brand: p.brands?.split(',')[0],
    source: 'OFF',
    per100: { kcal: Math.round(kcal), protein: r1(num('proteins_100g')), carbs: r1(num('carbohydrates_100g')), fat: r1(num('fat_100g')) },
    servingG: sq > 0 ? Math.round(sq) : undefined,
    servingLabel: p.serving_size,
  }
}

export async function lookupBarcode(code: string): Promise<FoodHit | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,serving_quantity,serving_size,nutriments`)
  if (!res.ok) return null
  const data = (await res.json()) as { status?: number; product?: OffProduct }
  return data.status === 1 && data.product ? offToHit({ ...data.product, code }) : null
}

function titleCase(s: string) {
  return s.length > 3 && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s
}

export const scale = (per100: FoodHit['per100'], grams: number) => ({
  kcal: Math.round((per100.kcal * grams) / 100),
  protein: r1((per100.protein * grams) / 100),
  carbs: r1((per100.carbs * grams) / 100),
  fat: r1((per100.fat * grams) / 100),
})
