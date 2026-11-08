import { useMemo } from 'react'
import { MUSCLES, type Equipment, type Plan, type PlanBlock } from '../types'
import { setState, useStore } from '../lib/store'
import { MINIMUM, PLANS, cardioMinutes, estimateMin, exerciseFor, finisherStart, moveCount, planById, planSteps } from '../lib/plans'
import { MUSCLE_LABEL, muscleStates, suggest } from '../lib/coach'
import { setDraft, setDraftEq, useDraft, useDraftEq } from '../lib/draft'
import { unlockAudio } from '../lib/fx'
import { useNav } from '../nav'
import { Back, Bar, Label, Screen, useReorder } from '../components/kit'
import { LedMeter } from '../led/Led'
import SwapList from './SwapList'

const EQUIP: { value: Equipment; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'dumbbells', label: 'Home' },
  { value: 'bodyweight', label: 'No gear' },
]

/** The plan you're about to start: the coach's pick (or yours), with your swaps and order. */
function usePlanDraft() {
  const workouts = useStore((s) => s.workouts)
  const cardio = useStore((s) => s.cardio)
  const profileEq = useStore((s) => s.profile?.equipment ?? 'gym')
  const sug = useMemo(() => suggest({ workouts, cardio }), [workouts, cardio])
  const draft = useDraft()
  const eq = useDraftEq() ?? profileEq
  const base = draft ? planById(draft.planId) : sug.plan
  const blocks = draft ? draft.blocks : sug.plan.blocks
  const swapped = draft ? draft.swapped : sug.swaps.map((s) => s.to)
  const plan: Plan = { ...base, blocks }
  const edit = (fn: (b: PlanBlock[]) => PlanBlock[], newSwap?: string) =>
    setDraft({ planId: base.id, blocks: fn(blocks), swapped: newSwap ? [...swapped, newSwap] : swapped, picked: draft?.picked ?? false })
  return { sug, draft, eq, plan, swapped, edit }
}

/** Stable keys so a dragged row keeps its element while the list reorders. */
const blockKeys = (blocks: PlanBlock[]) => {
  const n = new Map<string, number>()
  return blocks.map((b) => {
    const k = b.slots.join('+')
    n.set(k, (n.get(k) ?? 0) + 1)
    return `${k}#${n.get(k)}`
  })
}

export function PlanScreen() {
  const nav = useNav()
  const { sug, draft, eq, plan, swapped, edit } = usePlanDraft()
  const fin = finisherStart(plan.blocks)
  const keys = blockKeys(plan.blocks)
  const handle = useReorder((from, to) =>
    edit((b) => {
      if (to < 0 || to >= fin) return b
      const out = [...b]
      ;[out[from], out[to]] = [out[to], out[from]]
      return out
    }),
  )
  const coach = !draft?.picked
  const nSwaps = plan.blocks.flatMap((b) => b.slots).filter((s) => swapped.includes(s)).length

  const start = () => {
    unlockAudio()
    setState((s) => ({
      ...s,
      profile: s.profile ? { ...s.profile, equipment: eq } : s.profile,
      active: { planId: plan.id, blocks: plan.blocks, planned: planSteps(plan, eq).length, equipment: eq, start: Date.now(), step: 0, sets: [], skipped: [] },
    }))
    setDraft(null)
    setDraftEq(null)
    nav.replace({ s: 'workout' })
  }

  const row = (bl: PlanBlock, i: number, slot: string, grip: boolean) => {
    const ex = exerciseFor(slot, eq)
    const cardio = i >= fin || ex.kind === 'interval' || ex.kind === 'cardio'
    return (
      <div className="row" key={slot}>
        {grip ? <span className="handle" aria-hidden="true" {...handle(i)}>⋮⋮</span> : <span className="handle" aria-hidden="true">⋮⋮</span>}
        <span className="name">{ex.name}{cardio ? ` · ${cardioMinutes(bl)} min` : ''}</span>
        {swapped.includes(slot) && <span className="tag">swapped</span>}
        <button className="btn sm" onClick={() => nav.go({ s: 'draftSwap', block: i, slot })}>Swap</button>
      </div>
    )
  }

  return (
    <Screen scroll>
      <Bar left={<Back label="Home" onClick={nav.back} />} right={<button className="link" onClick={() => nav.go({ s: 'bank' })}>All workouts</button>} />
      <div className="head">
        <span className="title">{plan.name}</span>
        <span className="muted" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
          {estimateMin(plan)} min ·{' '}
          <label className="pick muted" style={{ fontWeight: 400 }}>
            {EQUIP.find((e) => e.value === eq)?.label} ▾
            <select aria-label="Equipment" value={eq} onChange={(e) => setDraftEq(e.target.value as Equipment)}>
              {EQUIP.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </span>
      </div>
      <button className="card card-link" onClick={() => nav.go({ s: 'recovery' })}>
        <span className="cl-t">
          <span className="cl-a">{coach ? sug.reason : 'Your pick'}</span>
          <span className="small muted">{nSwaps ? `${nSwaps} move${nSwaps > 1 ? 's' : ''} swapped` : 'Muscle recovery'}</span>
        </span>
        <span className="muted">›</span>
      </button>
      <div className="rows">
        {plan.blocks.slice(0, fin).map((bl, i) => (
          <div key={keys[i]} data-drag="">
            {bl.slots.map((sl) => row(bl, i, sl, true))}
          </div>
        ))}
      </div>
      {fin < plan.blocks.length && (
        <>
          <Label>Cardio finisher</Label>
          <div className="rows">
            {plan.blocks.slice(fin).map((bl, k) => (
              <div key={keys[fin + k]}>{bl.slots.map((sl) => row(bl, fin + k, sl, false))}</div>
            ))}
          </div>
        </>
      )}
      <div className="spacer" />
      <div className="bottom-c">
        <button className="btn primary" onClick={start}>Start</button>
      </div>
    </Screen>
  )
}

export function DraftSwap({ block, slot }: { block: number; slot: string }) {
  const nav = useNav()
  const workouts = useStore((s) => s.workouts)
  const cardio = useStore((s) => s.cardio)
  const ms = useMemo(() => muscleStates({ workouts, cardio }), [workouts, cardio])
  const { eq, plan, edit } = usePlanDraft()
  return (
    <SwapList
      slot={slot}
      inPlan={plan.blocks.flatMap((b) => b.slots)}
      eq={eq}
      ms={ms}
      backLabel="Up next"
      onBack={nav.back}
      onPick={(to) => {
        edit((b) => b.map((bl, i) => (i === block ? { ...bl, slots: bl.slots.map((s) => (s === slot ? to : s)) } : bl)), to)
        nav.back()
      }}
    />
  )
}

export function RecoveryScreen() {
  const nav = useNav()
  const workouts = useStore((s) => s.workouts)
  const cardio = useStore((s) => s.cardio)
  const ms = useMemo(() => muscleStates({ workouts, cardio }), [workouts, cardio])
  return (
    <Screen scroll>
      <Bar left={<Back label="Up next" onClick={nav.back} />} />
      <div className="title">Recovery</div>
      <div className="rows">
        {MUSCLES.map((m) => (
          <div key={m} className="meter-row">
            <span className="m-n">{MUSCLE_LABEL[m]}</span>
            <LedMeter frac={ms[m].ready} />
            <span className="m-v">{ms[m].hoursLeft ? `${ms[m].hoursLeft} h` : '✓'}</span>
          </div>
        ))}
      </div>
      <p className="note" style={{ textAlign: 'left' }}>Goal: each muscle twice a week.</p>
    </Screen>
  )
}

export function Bank() {
  const nav = useNav()
  const workouts = useStore((s) => s.workouts)
  const cardio = useStore((s) => s.cardio)
  const up = useMemo(() => suggest({ workouts, cardio }).plan, [workouts, cardio])
  const others = [...PLANS.filter((p) => p.id !== up.id), MINIMUM]
  const pick = (p: Plan) => {
    if (p.id === up.id) setDraft(null)
    else setDraft({ planId: p.id, blocks: p.blocks, swapped: [], picked: true })
    nav.back()
  }
  const meta = (p: Plan) => `${estimateMin(p)} min · ${moveCount(p)} moves`
  return (
    <Screen scroll>
      <Bar left={<Back label="Up next" onClick={nav.back} />} />
      <div className="head">
        <span className="title">Workouts</span>
        <span className="muted num" style={{ fontSize: 15 }}>{others.length + 1}</span>
      </div>
      <div className="bank">
        <button className="tile next" onClick={() => pick(up)}>
          <span className="t-top">
            <span className="t-n">{up.name}</span>
            <span className="t-tag">UP NEXT</span>
          </span>
          <span className="t-m">{meta(up)}</span>
        </button>
        {others.map((p) => (
          <button key={p.id} className="tile" onClick={() => pick(p)}>
            <span className="t-n">{p.name}</span>
            <span className="t-m">{meta(p)}</span>
          </button>
        ))}
      </div>
    </Screen>
  )
}
