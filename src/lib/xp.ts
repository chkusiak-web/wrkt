import type { AppState, WorkoutLog } from '../types'
import { addDays, daysBetween, parseDay, today, weekStart } from './date'
import { currentWeight, targets, weightTrend } from './progress'

/** XP the phoenix eats each day. */
export const UPKEEP = 100
/** Days a level-up protects you from dropping a level. */
export const SAFE_DAYS = 7
/** A day this big gets sparkles for 24h. */
export const BIG_DAY = 250

export interface Level {
  name: string
  /** bank needed to reach the next level */
  next: number
  /** brand guide ramp: deep, low, mid, high, core */
  light: [string, string, string, string, string]
}

export const LEVELS: Level[] = [
  { name: 'Ember', next: 3000, light: ['#3E100A', '#F2361B', '#FF6A3D', '#FFC23D', '#FFF1D6'] },
  { name: 'Solar', next: 6000, light: ['#3A2604', '#E08A00', '#FFB81F', '#FFE45C', '#FFFBE0'] },
  { name: 'Acid', next: 10000, light: ['#132E06', '#3E9E0C', '#8EE01E', '#D4FF4A', '#F6FFE0'] },
  { name: 'Electric', next: 15000, light: ['#06243A', '#0A78C2', '#22C3FF', '#8FF0FF', '#F0FDFF'] },
  { name: 'Magenta', next: 20000, light: ['#33061F', '#B5106A', '#FF2E9A', '#FF8AD0', '#FFE6F4'] },
  { name: 'Ultraviolet', next: 30000, light: ['#1A0A3A', '#5A2CD6', '#8E5CFF', '#C9A8FF', '#F3EBFF'] },
  { name: 'Crown', next: Infinity, light: ['#2E2006', '#B88A1E', '#F2C14E', '#FFE7A3', '#FFFFFF'] },
]

export interface XPItem {
  label: string
  xp: number
  /** counts toward the daily 100 rather than straight to the bank */
  upkeep?: boolean
}

export interface DayXP {
  date: string
  items: XPItem[]
  total: number
}

export type Stage = 'egg1' | 'egg2' | 'egg3' | 1 | 2 | 3 | 4 | 5

export interface PhoenixState {
  level: number
  /** settled bank, plus today's surplus over 100 */
  bank: number
  today: DayXP
  yesterday: DayXP | null
  /** burned and hasn't risen yet */
  ash: boolean
  /** safe from dropping a level through this day (inclusive) */
  safeThrough: string | null
  bigDay: boolean
  stage: Stage
  lifetime: number
  /** most recent level change, for celebrations */
  lastEvent: { kind: 'up' | 'burn'; date: string; level: number; from: number } | null
  /** 0..1, how bright the flame burns (bank health) */
  flame: number
  started: boolean
}

const FULL_MEALS = 3

function workoutMinutes(w: WorkoutLog) {
  return (w.end - w.start) / 60000
}

/** Upkeep XP for one workout: 100 for the planned workout, 40 for the 10-min minimum. */
export function workoutUpkeep(w: WorkoutLog) {
  if (w.minimum) return 40
  const complete = w.complete ?? w.sets.length > 0
  if (complete) return 100
  return workoutMinutes(w) >= 10 ? 40 : 0
}

export function workoutBonuses(w: WorkoutLog): XPItem[] {
  const out: XPItem[] = []
  const s = w.stats
  if (s?.beats) out.push({ label: `${s.beats} set${s.beats > 1 ? 's' : ''} beat last time`, xp: s.beats * 5 })
  if (s?.prs) out.push({ label: `${s.prs} lifting PR${s.prs > 1 ? 's' : ''}`, xp: s.prs * 25 })
  if (s?.cardioPR) out.push({ label: 'Cardio PR', xp: 75 })
  // older cardio-day logs keep their bonus so past XP doesn't change
  if (w.type === 'conditioning' && w.rating === 'hard') out.push({ label: 'Cardio day rated hard', xp: 30 })
  if (w.extra && w.extra > 0) out.push({ label: 'Went beyond the plan', xp: 30 })
  if (!w.minimum && w.complete && workoutMinutes(w) <= 30 && !w.overruns) out.push({ label: 'Done in 30 min, no rest overruns', xp: 25 })
  return out
}

/** Everything the phoenix sees, computed fresh from the logs. Pure, so sync can't corrupt it. */
export function computePhoenix(state: AppState, now = Date.now()): PhoenixState {
  const day0 = today(now)
  const byDate = <T extends { date: string }>(xs: T[]) => {
    const m = new Map<string, T[]>()
    for (const x of xs) m.set(x.date, [...(m.get(x.date) ?? []), x])
    return m
  }
  const workouts = byDate(state.workouts)
  const foods = byDate(state.foods)
  const cardio = byDate(state.cardio ?? [])
  const checks = [...(state.checks ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  const profile = state.profile
  const t = profile ? targets(profile, currentWeight(state)) : null

  // 5-lb milestones: the day the 7-day average first crosses each one
  const milestoneDays = new Map<string, number>()
  if (profile) {
    let reached = 0
    for (const p of weightTrend(state.weights)) {
      const n = Math.floor((profile.startWeight - p.avg) / 5)
      if (n > reached) {
        milestoneDays.set(p.date, (milestoneDays.get(p.date) ?? 0) + (n - reached))
        reached = n
      }
    }
  }

  // fitness checks that improved on the previous one (at least 3 weeks apart)
  const checkDays = new Set<string>()
  let lastAwarded: (typeof checks)[number] | null = null
  for (const c of checks) {
    if (lastAwarded && daysBetween(lastAwarded.date, c.date) >= 21) {
      const hr = c.restingHr && lastAwarded.restingHr && c.restingHr < lastAwarded.restingHr
      const mile = c.mileSec && lastAwarded.mileSec && c.mileSec < lastAwarded.mileSec
      if (hr || mile) checkDays.add(c.date)
    }
    if (!lastAwarded || daysBetween(lastAwarded.date, c.date) >= 21) lastAwarded = c
  }

  const dayXP = (date: string): DayXP => {
    const items: XPItem[] = []
    const ws = workouts.get(date) ?? []
    const upkeep = Math.max(0, ...ws.map(workoutUpkeep))
    if (upkeep) items.push({ label: upkeep === 100 ? 'Workout done' : '10-min minimum', xp: upkeep, upkeep: true })
    for (const w of ws) items.push(...workoutBonuses(w))

    for (const c of cardio.get(date) ?? []) items.push({ label: `${c.minutes} min extra cardio (${c.hard ? 'hard' : 'easy'})`, xp: c.minutes * (c.hard ? 8 : 5) })

    const fs = foods.get(date) ?? []
    if (t && fs.reduce((a, f) => a + f.protein, 0) >= t.protein) items.push({ label: 'Hit protein target', xp: 50 })

    // Sunday: weekly food bonuses for Mon..Sun
    if (t && parseDay(date).getDay() === 0) {
      const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i))
      const allMeals = week.every((d) => new Set((foods.get(d) ?? []).map((f) => f.meal)).size >= FULL_MEALS)
      if (allMeals) items.push({ label: 'Logged every meal all week', xp: 500 })
      const allLogged = week.every((d) => (foods.get(d) ?? []).length > 0)
      const kcal = week.reduce((a, d) => a + (foods.get(d) ?? []).reduce((b, f) => b + f.kcal, 0), 0)
      if (allLogged && kcal <= t.kcal * 7) items.push({ label: 'Stayed in weekly calorie budget', xp: 150 })
    }

    if (checkDays.has(date)) items.push({ label: 'Fitness check improved', xp: 200 })
    const ms = milestoneDays.get(date)
    if (ms) items.push({ label: `${ms * 5} lb milestone`, xp: ms * 300 })

    return { date, items, total: items.reduce((a, i) => a + i.xp, 0) }
  }

  // The phoenix is born the first day you work out.
  const firstDay = [...workouts.keys()].sort()[0]
  if (!firstDay || firstDay > day0) {
    const td = dayXP(day0)
    return {
      level: 0, bank: 0, today: td, yesterday: null, ash: false, safeThrough: null, bigDay: false, stage: 'egg1',
      lifetime: td.total, lastEvent: null, flame: 0.3, started: false,
    }
  }

  let level = 0
  let bank = 0
  let ash = false
  let safeThrough = null as string | null
  let lifetime = 0
  let lastEvent = null as PhoenixState['lastEvent']
  let workoutDays = 0
  let yesterday: DayXP | null = null
  let todayXP: DayXP = dayXP(day0)

  const levelUpCheck = (d: string) => {
    while (level < LEVELS.length - 1 && bank >= LEVELS[level].next) {
      bank = 0
      level++
      safeThrough = addDays(d, SAFE_DAYS)
      lastEvent = { kind: 'up', date: d, level, from: level - 1 }
    }
  }

  for (let d = firstDay; d <= day0; d = addDays(d, 1)) {
    const x = d === day0 ? todayXP : dayXP(d)
    lifetime += x.total
    if ((workouts.get(d) ?? []).length) workoutDays++
    let rose = false
    if (ash && x.total >= 40) {
      ash = false // risen from the ashes; the rising day can't burn it again
      rose = true
    }
    if (d === day0) {
      // today isn't over: bank only the surplus so far, no upkeep charged yet
      bank += Math.max(0, x.total - UPKEEP)
      levelUpCheck(d)
      break
    }
    bank += x.total - UPKEEP
    if (bank < 0) {
      if (rose) bank = 0
      else if (safeThrough && d <= safeThrough) bank = 0
      else if (ash) bank = 0 // already ash: no further drops until it rises
      else {
        bank = 0
        ash = true
        const from = level
        level = Math.max(0, level - 1)
        lastEvent = { kind: 'burn', date: d, level, from }
      }
    }
    levelUpCheck(d)
    if (d === addDays(day0, -1)) yesterday = x
  }

  const stage: Stage =
    workoutDays <= 1 ? 'egg2' : workoutDays === 2 ? 'egg3' : workoutDays < 7 ? 1 : workoutDays < 14 ? 2 : workoutDays < 21 ? 3 : workoutDays < 28 ? 4 : 5

  return {
    level, bank, today: todayXP, yesterday, ash,
    safeThrough: safeThrough && safeThrough >= day0 ? safeThrough : null,
    bigDay: todayXP.total >= BIG_DAY || (yesterday?.total ?? 0) >= BIG_DAY,
    stage, lifetime, lastEvent,
    flame: ash ? 0 : Math.max(0.2, Math.min(1, 0.2 + bank / 600)),
    started: true,
  }
}

