import { useMemo, useState } from 'react'
import type { Equipment, Muscle } from '../types'
import { CARDIO_SLOTS, LIFT_SLOTS, baseSlot, exerciseFor, primaryMuscle, variantsOf } from '../lib/plans'
import { MUSCLE_LABEL, type MuscleState } from '../lib/coach'
import { Back, Bar, Label, Screen } from '../components/kit'

interface Option { slot: string; name: string; note: string; muscle?: Muscle; ready: number; hay: string }

const ALIAS: Record<string, string> = { db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', ohp: 'overhead press', bw: 'bodyweight', delts: 'shoulder', lats: 'back', abs: 'core', hams: 'hamstring', quad: 'quads' }

/** Pick a replacement move: same muscle first, then whatever is most rested. Search covers every exercise in the app. */
export default function SwapList({ slot, inPlan, eq, ms, onPick, onBack, backLabel }: {
  slot: string
  inPlan: string[]
  eq: Equipment
  ms: Record<Muscle, MuscleState>
  onPick: (slot: string) => void
  onBack: () => void
  backLabel: string
}) {
  const [q, setQ] = useState('')
  const cardio = CARDIO_SLOTS.includes(baseSlot(slot))
  const name = exerciseFor(slot, eq).name
  const pm = primaryMuscle(slot)

  const all = useMemo(() => {
    const taken = new Set([name, ...inPlan.map((s) => exerciseFor(s, eq).name)])
    const pool = (cardio ? CARDIO_SLOTS : LIFT_SLOTS).flatMap((s) => [s, ...variantsOf(s, eq)])
    const out: Option[] = []
    for (const s of pool) {
      const ex = exerciseFor(s, eq)
      if (taken.has(ex.name)) continue
      taken.add(ex.name)
      const m = cardio ? undefined : primaryMuscle(s)
      const ready = m ? ms[m].ready : 1
      const note = cardio ? (ex.kind === 'cardio' ? 'Steady' : 'Intervals') : m ? `${MUSCLE_LABEL[m]} · ${ready >= 1 ? 'rested' : `${Math.round(ready * 100)}%`}` : ''
      out.push({ slot: s, name: ex.name, note, muscle: m, ready, hay: `${ex.name} ${m ? MUSCLE_LABEL[m] : ''} ${s.includes('@') ? s.split('@')[1] : ''}`.toLowerCase() })
    }
    return out
  }, [slot, inPlan, eq, ms, cardio, name])

  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ALIAS[t] ?? t)
    .flatMap((t) => t.split(' '))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
  const byName = (a: Option, b: Option) => a.name.localeCompare(b.name)
  const same = all.filter((o) => pm && o.muscle === pm).sort((a, b) => b.ready - a.ready)
  const rest = all.filter((o) => !pm || o.muscle !== pm)
  const rested = [...rest].sort((a, b) => b.ready - a.ready).slice(0, 5)
  const groups: { label: string; items: Option[] }[] = tokens.length
    ? [{ label: '', items: all.filter((o) => tokens.every((t) => o.hay.includes(t))).sort(byName) }]
    : cardio
      ? [{ label: 'Cardio', items: [...all].sort(byName) }]
      : [
          { label: `Same muscle · ${pm ? MUSCLE_LABEL[pm] : ''}`, items: same },
          { label: 'Most rested', items: rested },
          { label: 'All exercises', items: rest.filter((o) => !rested.includes(o)).sort(byName) },
        ]

  return (
    <Screen scroll>
      <Bar left={<Back label={backLabel} onClick={onBack} />} />
      <div className="title">{name}</div>
      <input type="search" placeholder="Search any exercise" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      {groups.map((g, k) =>
        g.items.length ? (
          <div key={k}>
            {g.label && <Label>{g.label}</Label>}
            <div className="rows">
              {g.items.map((o) => (
                <button key={o.slot} className="row press" onClick={() => onPick(o.slot)}>
                  <span className="name">{o.name}</span>
                  <span className="sub" style={{ flex: 'none' }}>{o.note}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
      {tokens.length > 0 && !groups[0].items.length && <p className="note">Nothing matches.</p>}
    </Screen>
  )
}
