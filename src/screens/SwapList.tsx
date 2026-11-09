import { useMemo, useState } from 'react'
import type { Equipment, Muscle } from '../types'
import { CARDIO_SLOTS, exerciseFor } from '../lib/plans'
import { MUSCLE_LABEL, swapOptions, type MuscleState } from '../lib/coach'
import { Back, Bar, Label, Screen } from '../components/kit'

/** Pick a replacement move: same muscle first, then whatever is most rested. Search covers everything. */
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
  const cardio = CARDIO_SLOTS.includes(slot)
  const name = exerciseFor(slot, eq).name

  const all = useMemo(() => {
    const seen = new Set([name])
    if (cardio)
      return CARDIO_SLOTS.filter((s) => s !== slot)
        .map((s) => ({ slot: s, name: exerciseFor(s, eq).name, note: exerciseFor(s, eq).kind === 'cardio' ? 'Steady' : 'Intervals', same: false, muscle: undefined as Muscle | undefined }))
        .filter((o) => !seen.has(o.name) && seen.add(o.name))
    return swapOptions(slot, inPlan, ms)
      .map((o) => ({ slot: o.slot, name: exerciseFor(o.slot, eq).name, note: `${MUSCLE_LABEL[o.muscle]} · ${o.ready >= 1 ? 'rested' : `${Math.round(o.ready * 100)}%`}`, same: o.same, muscle: o.muscle as Muscle | undefined }))
      .filter((o) => !seen.has(o.name) && seen.add(o.name))
  }, [slot, inPlan, eq, ms, cardio, name])

  const term = q.trim().toLowerCase()
  const sameM = all.find((o) => o.same)?.muscle
  const groups: { label: string; items: typeof all }[] = term
    ? [{ label: '', items: all.filter((o) => o.name.toLowerCase().includes(term) || o.note.toLowerCase().includes(term)) }]
    : cardio
      ? [{ label: 'Cardio', items: all }]
      : [
          { label: `Same muscle · ${sameM ? MUSCLE_LABEL[sameM] : ''}`, items: all.filter((o) => o.same) },
          { label: 'Most rested', items: all.filter((o) => !o.same).slice(0, 6) },
        ]

  return (
    <Screen scroll>
      <Bar left={<Back label={backLabel} onClick={onBack} />} />
      <div className="title">{name}</div>
      <input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search moves" />
      {groups.map((g, k) =>
        g.items.length ? (
          <div key={k}>
            {g.label && <Label>{g.label}</Label>}
            <div className="rows">
              {g.items.map((o) => (
                <button key={o.slot} className="row press" onClick={() => onPick(o.slot)}>
                  <span className="name">{o.name}</span>
                  <span className="sub">{o.note}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
      {term && !groups[0].items.length && <p className="note">Nothing matches.</p>}
    </Screen>
  )
}
