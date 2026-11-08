import { useState } from 'react'
import type { Meal } from '../types'
import { setState, useStore } from '../lib/store'
import { addDays, fmtDay, today } from '../lib/date'
import { currentWeight, targets } from '../lib/progress'
import { useNav } from '../nav'
import { Back, Bar, Screen } from '../components/kit'
import { LedMeter, LedNum } from '../led/Led'

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
]

export const guessMeal = (): Meal => {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

/** Carbs and fat targets: 30% of calories from fat, the rest after protein from carbs. */
export function macroTargets(kcal: number, protein: number) {
  const fat = Math.round((kcal * 0.3) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat }
}

export default function FoodDay({ date: initial }: { date: string }) {
  const nav = useNav()
  const state = useStore((s) => s)
  const [date, setDate] = useState(initial)
  const [open, setOpen] = useState<Meal | null>(null)
  const entries = state.foods.filter((f) => f.date === date)
  const t = state.profile ? targets(state.profile, currentWeight(state)) : { kcal: 2000, protein: 150 }
  const kcal = Math.round(entries.reduce((a, f) => a + f.kcal, 0))
  const protein = Math.round(entries.reduce((a, f) => a + f.protein, 0))
  const left = t.kcal - kcal
  const remove = (id: string) => setState((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id), deleted: [...(s.deleted ?? []), id] }))
  const isToday = date === today()

  return (
    <Screen scroll>
      <Bar
        left={<Back label="Home" onClick={() => nav.reset({ s: 'home' })} />}
        center={
          <>
            <button className="link" style={{ width: 36, justifyContent: 'center', fontSize: 18 }} aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
            <span>{isToday ? 'Today' : fmtDay(date)}</span>
            <button className="link" style={{ width: 36, justifyContent: 'center', fontSize: 18, color: isToday ? 'var(--dim)' : undefined }} aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>›</button>
          </>
        }
        right={<span style={{ width: 44 }} />}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <LedNum value={String(Math.abs(left))} fitStr="8888" w={170} h={64} label={`${Math.abs(left)} calories ${left >= 0 ? 'left' : 'over'}`} />
        <span className="small muted">{left >= 0 ? 'left' : 'over'}</span>
        <span className="small muted num">{kcal.toLocaleString()} / {t.kcal.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="head" style={{ fontSize: 14 }}>
          <span>Protein</span>
          <span className="num">{protein} / {t.protein}</span>
        </div>
        <LedMeter frac={protein / Math.max(1, t.protein)} />
      </div>
      <div className="meals grow">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.value)
          const sum = Math.round(list.reduce((a, e) => a + e.kcal, 0))
          return (
            <div className="meal" key={m.value}>
              <div className="m-h">
                <span className="label" style={{ paddingTop: 0 }}>{m.label} · {sum}</span>
                <button className="btn xs" aria-label={`Add to ${m.label}`} onClick={() => nav.go({ s: 'add', date, meal: m.value })}>+</button>
              </div>
              {open === m.value && list.length ? (
                list.map((e) => (
                  <div className="m-e" key={e.id}>
                    <span style={{ flex: 1, minWidth: 0 }}>{e.name} <span className="muted xs">· {e.kcal}</span></span>
                    <button className="link" style={{ padding: '0 6px', fontSize: 16 }} aria-label={`Delete ${e.name}`} onClick={() => remove(e.id)}>×</button>
                  </div>
                ))
              ) : (
                <button className={`m-i ${list.length ? '' : 'empty'}`} disabled={!list.length} onClick={() => setOpen(m.value)}>
                  {list.length ? list.map((e) => e.name).join(', ') : '—'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="bottom-c">
        <button className="btn" onClick={() => nav.go({ s: 'scan', date, meal: guessMeal() })}>Scan</button>
        <button className="btn primary wide" onClick={() => nav.go({ s: 'add', date, meal: guessMeal() })}>+ Food</button>
      </div>
    </Screen>
  )
}
