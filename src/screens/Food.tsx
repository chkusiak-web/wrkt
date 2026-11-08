import { useEffect, useMemo, useRef, useState } from 'react'
import type { FoodEntry, Meal } from '../types'
import { setState, useStore } from '../lib/store'
import { addDays, today, fmtDay, uid } from '../lib/date'
import { currentWeight, targets } from '../lib/progress'
import { lookupBarcode, scale, searchUSDA, type FoodHit } from '../lib/food'
import { Bar, Card, Seg, Stepper } from '../components/ui'

const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

const guessMeal = (): Meal => {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'pick'; hit: FoodHit } | { kind: 'quick' } | { kind: 'scan' }

export default function Food() {
  const state = useStore((s) => s)
  const [date, setDate] = useState(today())
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [meal, setMeal] = useState<Meal>(guessMeal())
  const entries = state.foods.filter((f) => f.date === date)
  const t = state.profile ? targets(state.profile, currentWeight(state)) : null
  const tot = entries.reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const add = (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) => {
    setState((s) => ({ ...s, foods: [...s.foods, { ...e, id: uid(), date, meal, ts: Date.now() }] }))
    setMode({ kind: 'list' })
  }
  const remove = (id: string) => setState((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id), deleted: [...(s.deleted ?? []), id] }))

  if (mode.kind === 'pick') return <Amount hit={mode.hit} meal={meal} setMeal={setMeal} onAdd={add} onBack={() => setMode({ kind: 'add' })} />
  if (mode.kind === 'quick') return <Quick meal={meal} setMeal={setMeal} onAdd={add} onBack={() => setMode({ kind: 'list' })} />
  if (mode.kind === 'scan') return <Scan onFound={(hit) => setMode({ kind: 'pick', hit })} onBack={() => setMode({ kind: 'add' })} />
  if (mode.kind === 'add') return <Search onPick={(hit) => setMode({ kind: 'pick', hit })} onQuick={() => setMode({ kind: 'quick' })} onScan={() => setMode({ kind: 'scan' })} onBack={() => setMode({ kind: 'list' })} onRelog={add} />

  return (
    <div className="screen">
      <div className="card-head">
        <button className="ghost" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <h1>{date === today() ? 'Today' : fmtDay(date)}</h1>
        <button className="ghost" disabled={date >= today()} onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>
      {t && (
        <Card>
          <Bar label="Calories" value={tot.kcal} max={t.kcal} right={`${Math.round(tot.kcal)} / ${t.kcal}`} />
          <Bar label="Protein" value={tot.protein} max={t.protein} color="var(--accent2)" right={`${Math.round(tot.protein)} / ${t.protein} g`} />
          <div className="muted small">Carbs {Math.round(tot.carbs)} g · Fat {Math.round(tot.fat)} g</div>
        </Card>
      )}
      <button className="primary big-btn" onClick={() => setMode({ kind: 'add' })}>+ Add food</button>
      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.value)
        if (!list.length) return null
        return (
          <Card key={m.value}>
            <div className="card-head">
              <h2>{m.label}</h2>
              <span className="muted">{Math.round(list.reduce((a, e) => a + e.kcal, 0))} kcal</span>
            </div>
            {list.map((e) => (
              <div key={e.id} className="food-row">
                <div>
                  <div>{e.name}</div>
                  <div className="muted small">{e.grams ? `${e.grams} g · ` : ''}{e.kcal} kcal · {e.protein} g protein</div>
                </div>
                <button className="ghost small-btn" onClick={() => remove(e.id)} aria-label="delete">✕</button>
              </div>
            ))}
          </Card>
        )
      })}
    </div>
  )
}

function Search({ onPick, onQuick, onScan, onBack, onRelog }: { onPick: (h: FoodHit) => void; onQuick: () => void; onScan: () => void; onBack: () => void; onRelog: (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) => void }) {
  const foods = useStore((s) => s.foods)
  const key = useStore((s) => s.profile?.usdaKey ?? '')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // recent unique foods, most recent first
  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: FoodEntry[] = []
    for (let i = foods.length - 1; i >= 0 && out.length < 15; i--) {
      const k = foods[i].name.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        out.push(foods[i])
      }
    }
    return out
  }, [foods])

  const run = async () => {
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    try {
      setHits(await searchUSDA(q.trim(), key))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  const filteredRecent = q ? recent.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : recent

  return (
    <div className="screen">
      <div className="card-head">
        <button className="ghost" onClick={onBack}>‹ Back</button>
        <h1>Add food</h1>
        <span />
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void run() }}>
        <input autoFocus placeholder="Search foods (e.g. chicken breast)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="primary" type="submit">{busy ? '…' : 'Search'}</button>
      </form>
      <div className="row">
        <button onClick={onScan}>📷 Scan barcode</button>
        <button onClick={onQuick}>⚡ Quick add</button>
      </div>
      {err && <div className="warn">{err}</div>}
      {hits.length > 0 && (
        <Card>
          {hits.map((h) => (
            <button key={h.id} className="hit" onClick={() => onPick(h)}>
              <div>{h.name}</div>
              <div className="muted small">{h.brand ? `${h.brand} · ` : ''}{h.per100.kcal} kcal · {h.per100.protein} g protein per 100 g</div>
            </button>
          ))}
        </Card>
      )}
      {filteredRecent.length > 0 && (
        <Card>
          <h2>Recent · tap to log again</h2>
          {filteredRecent.map((r) => (
            <button key={r.id} className="hit" onClick={() => onRelog({ name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, per100: r.per100 })}>
              <div>{r.name}</div>
              <div className="muted small">{r.grams ? `${r.grams} g · ` : ''}{r.kcal} kcal · {r.protein} g protein</div>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}

function Amount({ hit, meal, setMeal, onAdd, onBack }: { hit: FoodHit; meal: Meal; setMeal: (m: Meal) => void; onAdd: (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) => void; onBack: () => void }) {
  const [grams, setGrams] = useState(hit.servingG ?? 100)
  const n = scale(hit.per100, grams)
  return (
    <div className="screen">
      <div className="card-head">
        <button className="ghost" onClick={onBack}>‹ Back</button>
        <span />
      </div>
      <h1>{hit.name}</h1>
      {hit.brand && <div className="muted">{hit.brand}</div>}
      <Card>
        <Stepper label="grams" value={grams} onChange={setGrams} step={10} />
        {hit.servingG && (
          <div className="row">
            {[0.5, 1, 1.5, 2].map((m) => (
              <button key={m} onClick={() => setGrams(Math.round(hit.servingG! * m))}>{m} serving</button>
            ))}
          </div>
        )}
        {hit.servingLabel && <div className="muted small">1 serving = {hit.servingLabel} ({hit.servingG} g)</div>}
        <div className="big">{n.kcal} kcal</div>
        <div>{n.protein} g protein · {n.carbs} g carbs · {n.fat} g fat</div>
      </Card>
      <Seg options={MEALS} value={meal} onChange={setMeal} />
      <button className="primary big-btn" onClick={() => onAdd({ name: hit.name, grams, ...n, per100: hit.per100 })}>Add</button>
      <p className="muted small">Source: {hit.source === 'USDA' ? 'USDA FoodData Central' : 'Open Food Facts'}</p>
    </div>
  )
}

function Quick({ meal, setMeal, onAdd, onBack }: { meal: Meal; setMeal: (m: Meal) => void; onAdd: (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  return (
    <div className="screen">
      <div className="card-head">
        <button className="ghost" onClick={onBack}>‹ Back</button>
        <h1>Quick add</h1>
        <span />
      </div>
      <Card>
        <label>What was it?</label>
        <input placeholder="e.g. Burrito bowl" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row">
          <Stepper label="kcal" value={kcal} onChange={setKcal} step={50} />
          <Stepper label="protein g" value={protein} onChange={setProtein} step={5} />
        </div>
      </Card>
      <Seg options={MEALS} value={meal} onChange={setMeal} />
      <button className="primary big-btn" disabled={!kcal} onClick={() => onAdd({ name: name || 'Quick add', kcal, protein, carbs: 0, fat: 0 })}>Add</button>
    </div>
  )
}

interface Detector { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

function Scan({ onFound, onBack }: { onFound: (h: FoodHit) => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const supported = 'BarcodeDetector' in window

  const lookup = async (c: string) => {
    setMsg('Looking up…')
    try {
      const hit = await lookupBarcode(c)
      if (hit) onFound(hit)
      else setMsg(`Not found (${c}). Try search or quick add.`)
    } catch {
      setMsg('Lookup failed. Check your connection.')
    }
  }

  useEffect(() => {
    if (!supported) return
    let stream: MediaStream | null = null
    let stop = false
    const Ctor = (window as unknown as { BarcodeDetector: new (o: object) => Detector }).BarcodeDetector
    const det = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        while (!stop) {
          const found = await det.detect(video.current).catch(() => [])
          if (found[0]) {
            stop = true
            void lookup(found[0].rawValue)
            break
          }
          await new Promise((r) => setTimeout(r, 300))
        }
      } catch {
        setMsg('Camera not available. Type the barcode number instead.')
      }
    })()
    return () => {
      stop = true
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen">
      <div className="card-head">
        <button className="ghost" onClick={onBack}>‹ Back</button>
        <h1>Scan barcode</h1>
        <span />
      </div>
      {supported ? <video ref={video} className="scanner" playsInline muted /> : <p className="muted">Live scanning isn't supported in this browser. Type the number under the barcode.</p>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (code) void lookup(code) }}>
        <input inputMode="numeric" placeholder="Barcode number" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="primary" type="submit">Look up</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
