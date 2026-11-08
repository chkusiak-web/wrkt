import { MUSCLES, type AppState, type Muscle, type Plan, type PlanBlock, type WorkoutLog } from '../types'
import { PLANS, SLOT_MUSCLES, STRENGTH_SLOTS, planById, primaryMuscle, slotOfExercise } from './plans'

const HOUR = 3600_000
/** Weighted sets per muscle that count as a real session for the 2x/week goal. */
const SESSION_SETS = 1.5
const WEEKLY_GOAL = 2

export const MUSCLE_LABEL: Record<Muscle, string> = {
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', chest: 'Chest',
  back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', core: 'Core',
}

export interface MuscleState {
  /** 0 = just trained hard, 1 = fully recovered */
  ready: number
  hoursLeft: number
  /** sessions in the last 7 days */
  week: number
}

/** Weighted sets per muscle in one workout. Uses what was actually logged, so swaps and skips count. */
function workoutLoad(w: WorkoutLog): Partial<Record<Muscle, number>> {
  const effort = w.rating === 'hard' ? 1.2 : w.rating === 'easy' ? 0.8 : 1
  const out: Partial<Record<Muscle, number>> = {}
  for (const set of w.sets) {
    const slot = slotOfExercise(set.exerciseId)
    const m = slot ? SLOT_MUSCLES[slot] : undefined
    if (!m) continue
    for (const [k, v] of Object.entries(m) as [Muscle, number][]) out[k] = (out[k] ?? 0) + v * effort
  }
  return out
}

/** Recovery time grows with how hard the muscle was hit: ~42 h after 3 sets, ~60 h after 6, max 96 h. */
const hoursNeeded = (load: number) => Math.min(96, 24 + 6 * load)

export function muscleStates(state: Pick<AppState, 'workouts' | 'cardio'>, now = Date.now()): Record<Muscle, MuscleState> {
  const events: { t: number; load: Partial<Record<Muscle, number>> }[] = state.workouts.map((w) => ({ t: w.end || w.start, load: workoutLoad(w) }))
  // long or hard extra cardio (runs, rides, stairs) tires the legs a little
  for (const c of state.cardio ?? []) {
    if (c.minutes >= 20 || c.hard) events.push({ t: c.ts, load: { quads: c.hard ? 1.5 : 1, calves: 1 } })
  }
  const out = {} as Record<Muscle, MuscleState>
  for (const m of MUSCLES) {
    let ready = 1
    let hoursLeft = 0
    let week = 0
    for (const e of events) {
      const load = e.load[m] ?? 0
      if (!load) continue
      const age = (now - e.t) / HOUR
      if (age < 0) continue
      if (age < 24 * 7 && load >= SESSION_SETS) week++
      const need = hoursNeeded(load)
      if (age < need) {
        ready = Math.min(ready, age / need)
        hoursLeft = Math.max(hoursLeft, need - age)
      }
    }
    out[m] = { ready, hoursLeft: Math.round(hoursLeft), week }
  }
  return out
}

/** Share of a plan's lifting work that lands on each muscle. */
function planShares(blocks: PlanBlock[]) {
  const load: Partial<Record<Muscle, number>> = {}
  let total = 0
  for (const bl of blocks)
    for (const slot of bl.slots)
      for (const [k, v] of Object.entries(SLOT_MUSCLES[slot] ?? {}) as [Muscle, number][]) {
        load[k] = (load[k] ?? 0) + v * bl.sets
        total += v * bl.sets
      }
  return { load, total }
}

/** How much a muscle wants work today: rested, and more so if it's behind on 2x/week. */
const want = (s: MuscleState) => s.ready * (0.7 + 0.3 * (Math.max(0, WEEKLY_GOAL - s.week) / WEEKLY_GOAL))

function scoreBlocks(blocks: PlanBlock[], ms: Record<Muscle, MuscleState>) {
  const { load, total } = planShares(blocks)
  if (!total) return 0
  let score = 0
  for (const [k, v] of Object.entries(load) as [Muscle, number][]) score += (v / total) * want(ms[k])
  return score
}

export interface Suggestion {
  plan: Plan
  /** short reason, e.g. "Rested: quads, back" */
  reason: string
  swaps: { from: string; to: string }[]
  ms: Record<Muscle, MuscleState>
}

/**
 * Picks the bank workout that best fits what's rested and what's behind on 2x/week,
 * then swaps any lift whose main muscle is still recovering for a fresh one.
 */
export function suggest(state: Pick<AppState, 'workouts' | 'cardio'>, now = Date.now()): Suggestion {
  const ms = muscleStates(state, now)
  const last = [...state.workouts].reverse().find((w) => !w.minimum)
  const lifts = PLANS.filter((p) => p.type !== 'easy')
  let best = lifts[0]
  let bestScore = -1
  for (const p of lifts) {
    const sc = scoreBlocks(p.blocks, ms) - (last?.planId === p.id ? 0.05 : 0)
    if (sc > bestScore) {
      best = p
      bestScore = sc
    }
  }

  const avgReady = MUSCLES.reduce((a, m) => a + ms[m].ready, 0) / MUSCLES.length
  if (bestScore < 0.35 || avgReady < 0.55) {
    const plan = planById(last?.planId === 'easy' ? 'mobility' : 'easy')
    return { plan, reason: 'Most muscles still recovering', swaps: [], ms }
  }

  // adjust: replace lifts that hit a recovering muscle
  const used = new Set(best.blocks.flatMap((bl) => bl.slots))
  const swaps: Suggestion['swaps'] = []
  const blocks = best.blocks.map((bl) => ({
    ...bl,
    slots: bl.slots.map((slot) => {
      const pm = primaryMuscle(slot)
      if (!pm || !STRENGTH_SLOTS.includes(slot) || ms[pm].ready >= 0.6) return slot
      let pick: string | null = null
      let pickWant = want(ms[pm]) + 0.1
      for (const alt of STRENGTH_SLOTS) {
        const am = primaryMuscle(alt)
        if (!am || used.has(alt)) continue
        const w = want(ms[am])
        if (w > pickWant) {
          pick = alt
          pickWant = w
        }
      }
      if (!pick) return slot
      used.add(pick)
      swaps.push({ from: slot, to: pick })
      return pick
    }),
  }))
  const plan = { ...best, blocks }

  const { load } = planShares(blocks)
  const top = (Object.entries(load) as [Muscle, number][])
    .filter(([m]) => ms[m].ready >= 0.8)
    .map(([m, v]) => [m, v * want(ms[m])] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([m]) => MUSCLE_LABEL[m].toLowerCase())
  return { plan, reason: top.length ? `Rested: ${top.join(', ')}` : 'Muscles partly recovered, keep it smooth', swaps, ms }
}

/** Lifts to offer when swapping a slot mid-workout: same main muscle first, then the most rested. */
export function swapOptions(slot: string, inPlan: string[], ms: Record<Muscle, MuscleState>) {
  const pm = primaryMuscle(slot)
  return STRENGTH_SLOTS.filter((s) => s !== slot && !inPlan.includes(s))
    .map((s) => {
      const m = primaryMuscle(s)!
      return { slot: s, muscle: m, same: m === pm, ready: ms[m].ready }
    })
    .sort((a, b) => Number(b.same) - Number(a.same) || b.ready - a.ready)
}
