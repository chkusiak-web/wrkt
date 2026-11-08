export type Equipment = 'gym' | 'dumbbells' | 'bodyweight'
export type Sex = 'male' | 'female'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type WorkoutType = 'strength' | 'conditioning' | 'easy'

export const MUSCLES = ['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'core'] as const
export type Muscle = (typeof MUSCLES)[number]

/** weighted: weight x reps. reps: bodyweight reps. hold: seconds. interval: work/rest rounds, output = reps or cals per round. */
export type ExerciseKind = 'weighted' | 'reps' | 'hold' | 'interval' | 'cardio'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  cue?: string
  /** label for the number logged each set/round */
  unit?: string
}

export interface PlanBlock {
  /** movement slots; 2 = superset (alternate) */
  slots: string[]
  sets: number
  repMin: number
  repMax: number
  /** seconds of rest after each set */
  rest: number
  /** interval blocks only */
  work?: number
}

export interface Plan {
  id: string
  name: string
  type: WorkoutType
  blurb: string
  blocks: PlanBlock[]
}

export interface SetLog {
  exerciseId: string
  weight: number
  reps: number
  ts: number
}

export interface WorkoutLog {
  id: string
  date: string
  planId: string
  planName: string
  type: WorkoutType
  equipment?: Equipment
  start: number
  end: number
  sets: SetLog[]
  note?: string
  /** the 10-minute minimum plan */
  minimum?: boolean
  /** at least 75% of the plan's steps done */
  complete?: boolean
  /** self-rated effort, cardio days */
  rating?: 'easy' | 'hard'
  /** rest timer extensions (+15s taps) */
  overruns?: number
  /** XP-relevant results, computed when the workout is saved */
  stats?: { beats: number; prs: number; cardioPR: boolean }
  /** sets/rounds done beyond the planned workout */
  extra?: number
}

export interface ExtraCardio {
  id: string
  date: string
  minutes: number
  hard: boolean
  ts: number
}

export interface FitnessCheck {
  id: string
  date: string
  restingHr?: number
  /** 1-mile time in seconds */
  mileSec?: number
  ts: number
}

export interface FoodEntry {
  id: string
  date: string
  meal: Meal
  name: string
  grams?: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** per-100g values, so a recent food can be re-logged at a new amount */
  per100?: { kcal: number; protein: number; carbs: number; fat: number }
  ts: number
}

export interface WeightEntry {
  date: string
  lbs: number
}

export interface Profile {
  sex: Sex
  age: number
  heightIn: number
  startWeight: number
  goalWeight: number
  /** 1.2 sedentary ... 1.725 very active */
  activity: number
  equipment: Equipment
  weeklyLossLb: number
  usdaKey: string
  restScale: number
}

export interface AppState {
  version: 1
  profile: Profile | null
  workouts: WorkoutLog[]
  foods: FoodEntry[]
  weights: WeightEntry[]
  cardio: ExtraCardio[]
  checks: FitnessCheck[]
  /** in-progress workout, so a refresh doesn't lose it */
  active: ActiveWorkout | null
  /** ids of deleted foods/workouts, so sync doesn't bring them back */
  deleted?: string[]
  /** last local change, ms */
  updatedAt?: number
  profileUpdatedAt?: number
}

export interface ActiveWorkout {
  planId: string
  equipment: Equipment
  start: number
  /** index into the flattened step list */
  step: number
  sets: SetLog[]
  skipped: number[]
  overruns?: number
  /** the plan's blocks after coach adjustments and swaps */
  blocks?: PlanBlock[]
  /** number of steps in the plan at start; anything past it is extra */
  planned?: number
}
