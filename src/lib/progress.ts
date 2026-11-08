import type { AppState, Exercise, PlanBlock, Profile, SetLog, WorkoutLog } from '../types'
import { addDays, today } from './date'

/** Sets from the most recent workout that included this exercise. */
export function lastSetsFor(workouts: WorkoutLog[], exerciseId: string): SetLog[] {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const sets = workouts[i].sets.filter((s) => s.exerciseId === exerciseId)
    if (sets.length) return sets
  }
  return []
}

export interface Target {
  weight: number
  reps: number
  last?: SetLog
  note: string
}

const step = (weight: number) => (weight >= 100 ? 5 : 5)

/**
 * Double progression: add reps until every set hits the top of the range,
 * then add weight and drop back to the bottom.
 */
export function targetFor(ex: Exercise, block: PlanBlock, setNo: number, workouts: WorkoutLog[]): Target {
  const last = lastSetsFor(workouts, ex.id)
  const prev = last[setNo - 1] ?? last[last.length - 1]
  if (ex.kind === 'interval' || ex.kind === 'cardio') {
    if (!prev) return { weight: 0, reps: ex.kind === 'cardio' ? block.repMin : 0, note: 'First time. Set the bar.' }
    return { weight: 0, reps: prev.reps + (ex.kind === 'interval' && ex.unit !== 'level' ? 1 : 0), last: prev, note: 'Beat last round.' }
  }
  if (!prev) return { weight: 0, reps: block.repMin, note: 'First time. Pick a weight you could do 2-3 more reps with.' }
  const allTop = last.length >= block.sets && last.every((s) => s.reps >= block.repMax)
  if (ex.kind === 'weighted' && allTop) {
    return { weight: prev.weight + step(prev.weight), reps: block.repMin, last: prev, note: `You maxed reps last time. Weight goes up.` }
  }
  if (ex.kind === 'hold') return { weight: 0, reps: prev.reps + 5, last: prev, note: '+5 sec on last time.' }
  const reps = ex.kind === 'reps' ? prev.reps + 1 : Math.min(prev.reps + 1, block.repMax)
  return { weight: prev.weight, reps, last: prev, note: 'One more rep than last time.' }
}

/** Estimated 1-rep max (Epley). */
export const e1rm = (w: number, r: number) => (w > 0 ? w * (1 + r / 30) : r)

export interface PR {
  exerciseId: string
  value: number
  weight: number
  reps: number
  date: string
}

export function personalRecords(workouts: WorkoutLog[]): Record<string, PR> {
  const out: Record<string, PR> = {}
  for (const w of workouts) {
    for (const s of w.sets) {
      const v = e1rm(s.weight, s.reps)
      if (!out[s.exerciseId] || v > out[s.exerciseId].value) out[s.exerciseId] = { exerciseId: s.exerciseId, value: v, weight: s.weight, reps: s.reps, date: w.date }
    }
  }
  return out
}

/** Sets in `current` that beat every previous best for that exercise. */
export function newPRs(history: WorkoutLog[], current: SetLog[]): SetLog[] {
  const best = personalRecords(history)
  const seen = new Set<string>()
  const out: SetLog[] = []
  for (const s of current) {
    const prev = best[s.exerciseId]
    if (prev && e1rm(s.weight, s.reps) > prev.value && !seen.has(s.exerciseId)) {
      out.push(s)
      seen.add(s.exerciseId)
    }
  }
  return out
}

export const volume = (sets: SetLog[]) => sets.reduce((a, s) => a + (s.weight || 0) * s.reps, 0)

/** Consecutive days with a completed workout, counting back from today (or yesterday if today isn't done yet). */
export function streak(workouts: WorkoutLog[]) {
  const days = new Set(workouts.map((w) => w.date))
  let d = today()
  if (!days.has(d)) d = addDays(d, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return { count: n, doneToday: days.has(today()) }
}

export function bestStreak(workouts: WorkoutLog[]) {
  const days = [...new Set(workouts.map((w) => w.date))].sort()
  let best = 0
  let cur = 0
  let prev = ''
  for (const d of days) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

export function foodStreak(state: AppState) {
  const days = new Set(state.foods.map((f) => f.date))
  let d = today()
  if (!days.has(d)) d = addDays(d, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function currentWeight(state: AppState) {
  const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date))
  return w.length ? w[w.length - 1].lbs : (state.profile?.startWeight ?? 0)
}

/** Mifflin-St Jeor BMR x activity, minus a deficit sized to the weekly loss goal. */
export function targets(p: Profile, weightLbs: number) {
  const kg = weightLbs * 0.4536
  const cm = p.heightIn * 2.54
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  const tdee = bmr * p.activity
  const deficit = (p.weeklyLossLb * 3500) / 7
  const floor = p.sex === 'male' ? 1500 : 1200
  const kcal = Math.round(Math.max(floor, tdee - deficit) / 10) * 10
  const protein = Math.round(p.goalWeight * 0.8)
  return { kcal, protein, tdee: Math.round(tdee), deficit: Math.round(tdee - kcal) }
}

/** 7-day trailing average for each logged weight. */
export function weightTrend(weights: { date: string; lbs: number }[]) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((w) => {
    const from = addDays(w.date, -6)
    const win = sorted.filter((x) => x.date >= from && x.date <= w.date)
    return { date: w.date, lbs: w.lbs, avg: win.reduce((a, x) => a + x.lbs, 0) / win.length }
  })
}
