import type { FoodHit } from './food'

type Row = [string, number, number, number, number, string, number]

let rows: Row[] | null = null
let words: string[][] = []
let loading: Promise<Row[]> | null = null

/** Loads the bundled USDA list once. The service worker caches it, so it works offline. */
export function loadOfflineFoods(): Promise<Row[]> {
  if (rows) return Promise.resolve(rows)
  loading ??= fetch(`${import.meta.env.BASE_URL}foods.json`)
    .then((r) => (r.ok ? r.json() : { rows: [] }))
    .then((d: { rows: Row[] }) => {
      rows = d.rows
      words = rows.map((r) => r[0].toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean))
      return rows
    })
    .catch(() => {
      loading = null
      return []
    })
  return loading
}

const sing = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const SYNONYMS: Record<string, string> = { oatmeal: 'cereals oats', 'chicken breast': 'chicken broiler breast meat only', salmon: 'fish salmon', eggs: 'egg whole', egg: 'egg whole', steak: 'beef steak' }
const PLAIN = new Set(['raw', 'cooked', 'boiled', 'grilled', 'roasted', 'baked', 'plain', 'whole', 'fresh'])
const PROCESSED = new Set(['breaded', 'fried', 'frozen', 'prepackaged', 'dehydrated', 'canned', 'mix', 'restaurant', 'fast', 'babyfood', 'imitation', 'dry'])
let flags: { brand: boolean; plain: boolean; processed: number }[] = []

/**
 * Every query word must start some word in the name. Exact words near the start of the
 * name rank first; plain foods beat branded, breaded or processed ones.
 */
export function searchOffline(query: string, limit = 25): FoodHit[] {
  if (!rows) return []
  const raw = query.toLowerCase().trim()
  const q = (SYNONYMS[raw] ?? raw).split(/[^a-z0-9%]+/).filter(Boolean).map(sing)
  if (!q.length) return []
  if (flags.length !== rows.length)
    flags = rows.map((r, i) => ({
      brand: /[A-Z]{3,}/.test(r[0]),
      plain: words[i].some((w) => PLAIN.has(w)),
      processed: words[i].filter((w) => PROCESSED.has(w)).length,
    }))
  const scored: [number, number][] = []
  for (let i = 0; i < rows.length; i++) {
    const w = words[i]
    let score = 0
    let ok = true
    for (const t of q) {
      let best = Infinity
      for (let j = 0; j < w.length && best > j * 4; j++) {
        const x = sing(w[j])
        if (x === t) best = Math.min(best, j * 4)
        else if (x.startsWith(t)) best = Math.min(best, j * 4 + 8)
      }
      if (best === Infinity) {
        ok = false
        break
      }
      score += best
    }
    if (!ok) continue
    const f = flags[i]
    score += w.length * 0.5 + (f.brand ? 12 : 0) + f.processed * 6 - (f.plain ? 4 : 0)
    scored.push([score, i])
  }
  scored.sort((a, b) => a[0] - b[0])
  return scored.slice(0, limit).map(([, i]) => {
    const [name, kcal, protein, carbs, fat, servingLabel, servingG] = rows![i]
    return {
      id: `sr-${i}`,
      name,
      source: 'USDA' as const,
      per100: { kcal, protein, carbs, fat },
      servingG: servingG || undefined,
      servingLabel: servingLabel || undefined,
    }
  })
}
