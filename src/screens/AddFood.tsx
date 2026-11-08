const NONE: never[] = []
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FoodEntry, Meal, SavedFood } from '../types'
import { setState, useStore } from '../lib/store'
import { uid } from '../lib/date'
import { currentWeight, targets } from '../lib/progress'
import { lookupBarcode, scale, searchUSDA, type FoodHit } from '../lib/food'
import { loadOfflineFoods, searchOffline } from '../lib/offlineFoods'
import { useNav } from '../nav'
import { Back, Bar, Chips, HoldBtn, Screen } from '../components/kit'
import { Led } from '../led/Led'
import { MEALS, macroTargets } from './FoodDay'

type Tab = 'recent' | 'saved' | 'quick'
const OZ = 28.3495

const addEntry = (date: string, meal: Meal, e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) =>
  setState((s) => ({ ...s, foods: [...s.foods, { ...e, id: uid(), date, meal, ts: Date.now() }] }))

function MealPick({ meal, onChange }: { meal: Meal; onChange: (m: Meal) => void }) {
  return (
    <label className="pick">
      {MEALS.find((m) => m.value === meal)?.label} ▾
      <select aria-label="Meal" value={meal} onChange={(e) => onChange(e.target.value as Meal)}>
        {MEALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </label>
  )
}

/** How a logged amount reads: ounces for meat and fish sized amounts, else grams or the serving. */
const amountLabel = (grams?: number, servingG?: number, servingLabel?: string) => {
  if (!grams) return ''
  if (servingG && servingLabel && Math.abs(grams - servingG) < 1) return servingLabel
  return `${grams} g`
}

export function AddFood({ date, meal: m0 }: { date: string; meal: Meal }) {
  const nav = useNav()
  const foods = useStore((s) => s.foods)
  const saved = useStore((s) => s.saved) ?? NONE
  const key = useStore((s) => s.profile?.usdaKey ?? '')
  const [meal, setMeal] = useState(m0)
  const [tab, setTab] = useState<Tab>('recent')
  const [q, setQ] = useState('')
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState<FoodHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState('')

  useEffect(() => {
    void loadOfflineFoods().then(() => setReady(true))
  }, [])
  useEffect(() => {
    setOnline(null)
    setErr('')
  }, [q])
  // instant results from the food list saved on the phone, no internet needed
  const local = useMemo(() => (ready && q.trim().length >= 2 ? searchOffline(q) : []), [ready, q])

  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: FoodEntry[] = []
    for (let i = foods.length - 1; i >= 0 && out.length < 20; i--) {
      const k = foods[i].name.toLowerCase()
      if (!seen.has(k)) {
        seen.add(k)
        out.push(foods[i])
      }
    }
    return out
  }, [foods])

  const more = async () => {
    setBusy(true)
    setErr('')
    try {
      setOnline(await searchUSDA(q.trim(), key))
    } catch (e) {
      setErr(navigator.onLine ? (e instanceof Error ? e.message : 'Search failed') : 'Offline. Showing foods saved on your phone.')
    } finally {
      setBusy(false)
    }
  }

  const done = (name: string) => {
    setFlash(`Added ${name}`)
    setTimeout(() => setFlash(''), 1400)
  }
  const relog = (r: FoodEntry) => {
    addEntry(date, meal, { name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, per100: r.per100 })
    done(r.name)
  }
  const addSaved = (f: SavedFood) => {
    addEntry(date, meal, { name: f.name, grams: f.grams, ...scale(f.per100, f.grams), per100: f.per100 })
    done(f.name)
  }
  const hitOf = (r: FoodEntry): FoodHit | null => (r.per100 ? { id: r.id, name: r.name, source: 'USDA', per100: r.per100, servingG: r.grams } : null)
  const savedHit = (f: SavedFood): FoodHit => ({ id: f.id, name: f.name, source: 'USDA', per100: f.per100, servingG: f.servingG, servingLabel: f.servingLabel })

  const row = (k: string, name: string, detail: string, onOpen: (() => void) | null, onAdd: () => void) => (
    <div className="row" key={k}>
      <button className="two" style={{ border: 0, background: 'none', textAlign: 'left', color: 'inherit', padding: '8px 0' }} onClick={onOpen ?? onAdd}>
        <span className="name">{name}</span>
        <span className="sub">{detail}</span>
      </button>
      <button className="btn sm" aria-label={`Add ${name}`} onClick={onAdd}>+</button>
    </div>
  )
  const hitRow = (h: FoodHit) => {
    const g = h.servingG ?? 100
    return row(h.id, h.name, `${h.servingLabel ? h.servingLabel : `${g} g`} · ${Math.round((h.per100.kcal * g) / 100)}`, () => nav.go({ s: 'portion', date, meal, hit: h }), () => {
      addEntry(date, meal, { name: h.name, grams: g, ...scale(h.per100, g), per100: h.per100 })
      done(h.name)
    })
  }

  const searching = q.trim().length >= 2

  return (
    <Screen scroll>
      <Bar left={<Back label="Food" onClick={() => nav.reset({ s: 'food', date })} />} center={<MealPick meal={meal} onChange={setMeal} />} right={<span />} />
      <div className="searchrow">
        <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" />
        <button className="btn" onClick={() => nav.go({ s: 'scan', date, meal })}>Scan</button>
      </div>
      {flash && <div className="note accent" role="status">{flash}</div>}
      {searching ? (
        <>
          <div className="rows">{local.map(hitRow)}</div>
          {online && (
            <div className="rows">
              {online.map(hitRow)}
              {!online.length && <p className="note">No more results online.</p>}
            </div>
          )}
          {err ? (
            <p className="note">{err}</p>
          ) : (
            !online && (
              <div className="bottom-c">
                <button className="btn" onClick={() => void more()}>{busy ? '…' : 'More'}</button>
              </div>
            )
          )}
          {!local.length && !online && !busy && !err && <p className="note">Tap More to search online.</p>}
        </>
      ) : (
        <>
          <Chips value={tab} onChange={setTab} options={[{ value: 'recent', label: 'Recent' }, { value: 'saved', label: 'Saved' }, { value: 'quick', label: 'Quick' }]} />
          {tab === 'recent' && (
            <div className="rows">
              {recent.map((r) => {
                const h = hitOf(r)
                return row(r.id, r.name, `${amountLabel(r.grams)}${r.grams ? ' · ' : ''}${r.kcal}`, h ? () => nav.go({ s: 'portion', date, meal, hit: h, grams: r.grams }) : null, () => relog(r))
              })}
              {!recent.length && <p className="note">Foods you log show up here.</p>}
            </div>
          )}
          {tab === 'saved' && (
            <div className="rows">
              {saved.map((f) => row(f.id, f.name, `${amountLabel(f.grams, f.servingG, f.servingLabel)} · ${scale(f.per100, f.grams).kcal}`, () => nav.go({ s: 'portion', date, meal, hit: savedHit(f), grams: f.grams }), () => addSaved(f)))}
              {!saved.length && <p className="note">Tap ☆ on a food to save it here.</p>}
            </div>
          )}
          {tab === 'quick' && <Quick onAdd={(e) => { addEntry(date, meal, e); done(e.name) }} />}
        </>
      )}
    </Screen>
  )
}

function Quick({ onAdd }: { onAdd: (e: Omit<FoodEntry, 'id' | 'date' | 'meal' | 'ts'>) => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const k = Number(kcal) || 0
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!k) return
        onAdd({ name: name.trim() || 'Quick add', kcal: k, protein: Number(protein) || 0, carbs: 0, fat: 0 })
        setName('')
        setKcal('')
        setProtein('')
      }}
    >
      <input placeholder="What was it?" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <div className="frow">
        <input inputMode="numeric" placeholder="Calories" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ''))} aria-label="Calories" />
        <input inputMode="numeric" placeholder="Protein g" value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, ''))} aria-label="Protein grams" />
      </div>
      <div className="bottom-c"><button className="btn primary" disabled={!k}>Add</button></div>
    </form>
  )
}

type Unit = 'oz' | 'g' | 'srv'

export function Portion({ date, meal, hit, grams: g0 }: { date: string; meal: Meal; hit: FoodHit; grams?: number }) {
  const nav = useNav()
  const state = useStore((s) => s)
  const savedList = state.saved ?? []
  const isSaved = savedList.find((f) => f.name === hit.name)
  const start = g0 ?? hit.servingG ?? 100
  const [unit, setUnit] = useState<Unit>(hit.servingG && Math.abs(start - hit.servingG) < 1 ? 'srv' : 'oz')
  const [qty, setQty] = useState(() => (hit.servingG && Math.abs(start - hit.servingG) < 1 ? 1 : Math.round((start / OZ) * 2) / 2 || 1))
  const grams = Math.round(unit === 'g' ? qty : unit === 'oz' ? qty * OZ : qty * (hit.servingG ?? 100))
  const n = scale(hit.per100, grams)
  const step = unit === 'g' ? 10 : 0.5
  const val = useRef(qty)
  val.current = qty
  const changeUnit = (u: Unit) => {
    const q = u === 'g' ? Math.round(grams / 5) * 5 : u === 'oz' ? Math.max(0.5, Math.round((grams / OZ) * 2) / 2) : Math.max(0.5, Math.round((grams / (hit.servingG ?? 100)) * 2) / 2)
    setUnit(u)
    setQty(q)
  }
  const t0 = state.profile ? targets(state.profile, currentWeight(state)) : { kcal: 2000, protein: 150 }
  const T = macroTargets(t0.kcal, t0.protein)
  const eaten = state.foods.filter((f) => f.date === date).reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein, carbs: a.carbs + f.carbs, fat: a.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const after = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => Math.round(T[k] - eaten[k] - n[k])
  const note = (k: 'kcal' | 'protein' | 'carbs' | 'fat', u: string) => {
    const a = after(k)
    return a >= 0 ? (k === 'kcal' ? `${a} left today` : `${a} ${u} to go`) : `${-a}${u ? ` ${u}` : ''} over`
  }
  const macros = [
    { k: 'Calories', v: String(n.kcal), note: note('kcal', '') },
    { k: 'Protein', v: `${Math.round(n.protein)} g`, note: note('protein', 'g') },
    { k: 'Carbs', v: `${Math.round(n.carbs)} g`, note: note('carbs', 'g') },
    { k: 'Fat', v: `${Math.round(n.fat)} g`, note: note('fat', 'g') },
  ]
  const toggleSave = () =>
    setState((s) =>
      isSaved
        ? { ...s, saved: (s.saved ?? []).filter((f) => f.id !== isSaved.id), deleted: [...(s.deleted ?? []), isSaved.id] }
        : { ...s, saved: [...(s.saved ?? []), { id: uid(), name: hit.name, per100: hit.per100, grams, servingG: hit.servingG, servingLabel: hit.servingLabel, ts: Date.now() }] },
    )
  const str = qty % 1 ? qty.toFixed(1) : String(qty)
  const nudge = (d: number) => {
    const v = Math.max(step, Math.min(unit === 'g' ? 2000 : 99, Math.round((val.current + d) * 10) / 10))
    val.current = v
    setQty(v)
  }

  return (
    <Screen scroll>
      <Bar left={<Back label="Search" onClick={nav.back} />} right={<button className="link" aria-pressed={!!isSaved} onClick={toggleSave}>{isSaved ? '★ Saved' : '☆ Save'}</button>} />
      <div className="title md">{hit.name}</div>
      {hit.brand && <div className="muted small" style={{ marginTop: -10 }}>{hit.brand}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div className="lstep-row">
          <HoldBtn label="Less" onStep={() => nudge(-step)}>−</HoldBtn>
          <div className="led-box" style={{ width: 130, height: 64 }}>
            <Led cfg={{ fit: true, maxPitch: 8, bare: true, text: { str, fitStr: unit === 'g' ? '888' : '8.8', S: 1 } }} label={`${str} ${unit}`} />
          </div>
          <HoldBtn label="More" onStep={() => nudge(step)}>+</HoldBtn>
        </div>
        <Chips
          small
          value={unit}
          onChange={changeUnit}
          options={[{ value: 'oz' as Unit, label: 'oz' }, { value: 'g' as Unit, label: 'g' }, ...(hit.servingG ? [{ value: 'srv' as Unit, label: 'srv' }] : [])]}
        />
        {unit === 'srv' && hit.servingLabel && <span className="xs muted">1 srv = {hit.servingLabel}</span>}
      </div>
      <div className="macros">
        {macros.map((m) => (
          <div className="macro" key={m.k}>
            <span className="mc-k">{m.k}</span>
            <span>
              <div className="mc-v">{m.v}</div>
              <div className="mc-n">{m.note}</div>
            </span>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="bottom-c">
        <button
          className="btn primary"
          disabled={!grams}
          onClick={() => {
            addEntry(date, meal, { name: hit.name, grams, ...n, per100: hit.per100 })
            nav.reset({ s: 'food', date })
          }}
        >
          Add
        </button>
      </div>
    </Screen>
  )
}

interface Detector { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

export function ScanScreen({ date, meal }: { date: string; meal: Meal }) {
  const nav = useNav()
  const video = useRef<HTMLVideoElement>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const supported = 'BarcodeDetector' in window

  const lookup = async (c: string) => {
    setMsg('Looking up…')
    try {
      const hit = await lookupBarcode(c)
      if (hit) nav.replace({ s: 'portion', date, meal, hit })
      else setMsg(`Not found (${c}). Try search or Quick.`)
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
    <Screen scroll>
      <Bar left={<Back label="Food" onClick={nav.back} />} />
      <div className="title">Scan</div>
      {supported ? <video ref={video} className="scanner" playsInline muted /> : <p className="muted small">Live scanning isn't supported in this browser. Type the number under the barcode.</p>}
      <form className="searchrow" onSubmit={(e) => { e.preventDefault(); if (code) void lookup(code) }}>
        <input inputMode="numeric" placeholder="Barcode number" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Barcode number" />
        <button className="btn primary">Look up</button>
      </form>
      {msg && <p className="note">{msg}</p>}
    </Screen>
  )
}
