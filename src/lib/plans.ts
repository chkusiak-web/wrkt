import type { Equipment, Exercise, Plan, PlanBlock } from '../types'

/** Each movement slot maps to an exercise per equipment setup. */
const SLOTS: Record<string, Record<Equipment, Exercise>> = {
  squat: {
    gym: { id: 'bb-squat', name: 'Barbell Back Squat', kind: 'weighted', cue: 'Brace, sit between your hips, drive up.' },
    dumbbells: { id: 'db-goblet-squat', name: 'Goblet Squat', kind: 'weighted', cue: 'Elbows inside knees, chest tall.' },
    bodyweight: { id: 'bw-squat', name: 'Bodyweight Squat', kind: 'reps', cue: 'Full depth, fast up.' },
  },
  hpush: {
    gym: { id: 'bb-bench', name: 'Bench Press', kind: 'weighted', cue: 'Shoulder blades back, touch chest.' },
    dumbbells: { id: 'db-bench', name: 'Dumbbell Floor/Bench Press', kind: 'weighted', cue: 'Control down, press hard.' },
    bodyweight: { id: 'bw-pushup', name: 'Push-up', kind: 'reps', cue: 'Body straight. Elevate hands if needed.' },
  },
  hinge: {
    gym: { id: 'bb-rdl', name: 'Romanian Deadlift', kind: 'weighted', cue: 'Hips back, flat back, feel hamstrings.' },
    dumbbells: { id: 'db-rdl', name: 'Dumbbell RDL', kind: 'weighted', cue: 'Hips back, weights close to legs.' },
    bodyweight: { id: 'bw-glute-bridge', name: 'Single-leg Glute Bridge', kind: 'reps', cue: 'Squeeze at top 1 sec. Reps per leg.' },
  },
  hpull: {
    gym: { id: 'cable-row', name: 'Seated Cable Row', kind: 'weighted', cue: 'Pull to belly, squeeze back.' },
    dumbbells: { id: 'db-row', name: 'One-arm Dumbbell Row', kind: 'weighted', cue: 'Elbow to hip. Reps per arm.' },
    bodyweight: { id: 'bw-table-row', name: 'Inverted Row (table/bar)', kind: 'reps', cue: 'Chest to edge, body straight.' },
  },
  lunge: {
    gym: { id: 'db-walk-lunge', name: 'Dumbbell Walking Lunge', kind: 'weighted', cue: 'Long step, back knee near floor. Reps per leg.' },
    dumbbells: { id: 'db-split-squat', name: 'Dumbbell Split Squat', kind: 'weighted', cue: 'Torso tall. Reps per leg.' },
    bodyweight: { id: 'bw-rev-lunge', name: 'Reverse Lunge', kind: 'reps', cue: 'Step back, drive through front heel. Reps per leg.' },
  },
  vpush: {
    gym: { id: 'db-ohp', name: 'Overhead Press', kind: 'weighted', cue: 'Ribs down, press straight up.' },
    dumbbells: { id: 'db-ohp', name: 'Dumbbell Overhead Press', kind: 'weighted', cue: 'Ribs down, press straight up.' },
    bodyweight: { id: 'bw-pike', name: 'Pike Push-up', kind: 'reps', cue: 'Hips high, head toward floor.' },
  },
  vpull: {
    gym: { id: 'lat-pulldown', name: 'Lat Pulldown', kind: 'weighted', cue: 'Pull to upper chest, elbows down.' },
    dumbbells: { id: 'db-pullover', name: 'Dumbbell Pullover', kind: 'weighted', cue: 'Slight elbow bend, stretch then pull.' },
    bodyweight: { id: 'bw-superman', name: 'Prone Y-T Raise', kind: 'reps', cue: 'Lying face down, lift arms, squeeze back.' },
  },
  deadlift: {
    gym: { id: 'trap-dl', name: 'Trap Bar Deadlift', kind: 'weighted', cue: 'Push the floor away. Stand tall.' },
    dumbbells: { id: 'db-deadlift', name: 'Dumbbell Deadlift', kind: 'weighted', cue: 'Flat back, push the floor away.' },
    bodyweight: { id: 'bw-hip-hinge-jump', name: 'Broad Jump', kind: 'reps', cue: 'Swing arms, land soft.' },
  },
  core: {
    gym: { id: 'plank', name: 'Plank', kind: 'hold', unit: 'sec', cue: 'Squeeze glutes, ribs down.' },
    dumbbells: { id: 'plank', name: 'Plank', kind: 'hold', unit: 'sec', cue: 'Squeeze glutes, ribs down.' },
    bodyweight: { id: 'plank', name: 'Plank', kind: 'hold', unit: 'sec', cue: 'Squeeze glutes, ribs down.' },
  },
  carry: {
    gym: { id: 'farmer-carry', name: "Farmer's Carry", kind: 'weighted', unit: 'sec', cue: 'Heavy, tall, quick steps. Log seconds.' },
    dumbbells: { id: 'farmer-carry', name: "Farmer's Carry", kind: 'weighted', unit: 'sec', cue: 'Heavy, tall, quick steps. Log seconds.' },
    bodyweight: { id: 'bw-dead-bug', name: 'Dead Bug', kind: 'reps', cue: 'Low back pressed down. Reps per side.' },
  },
  finisher: {
    gym: { id: 'bike-sprint', name: 'Bike / Rower Sprint', kind: 'interval', unit: 'cal', cue: 'All out. Log calories per round.' },
    dumbbells: { id: 'db-thruster', name: 'Dumbbell Thrusters', kind: 'interval', unit: 'reps', cue: 'Squat + press, fast. Log reps per round.' },
    bodyweight: { id: 'burpee', name: 'Burpees', kind: 'interval', unit: 'reps', cue: 'Steady pace. Log reps per round.' },
  },
  intervals: {
    gym: { id: 'bike-intervals', name: 'Bike / Rower Intervals', kind: 'interval', unit: 'cal', cue: 'Hard push, then easy spin. Log cals per round.' },
    dumbbells: { id: 'jog-intervals', name: 'Run / Fast Walk Intervals', kind: 'interval', unit: 'level', cue: 'Hard = can only say a few words. Rate effort 1-10.' },
    bodyweight: { id: 'jog-intervals', name: 'Run / Fast Walk Intervals', kind: 'interval', unit: 'level', cue: 'Hard = can only say a few words. Rate effort 1-10.' },
  },
  circuit1: {
    gym: { id: 'kb-swing', name: 'Kettlebell Swing', kind: 'interval', unit: 'reps', cue: 'Snap hips. Log reps per round.' },
    dumbbells: { id: 'db-swing', name: 'Dumbbell Swing', kind: 'interval', unit: 'reps', cue: 'Snap hips. Log reps per round.' },
    bodyweight: { id: 'jump-squat', name: 'Squat Jumps', kind: 'interval', unit: 'reps', cue: 'Land soft. Log reps per round.' },
  },
  circuit2: {
    gym: { id: 'mountain-climber', name: 'Mountain Climbers', kind: 'interval', unit: 'reps', cue: 'Fast knees. Count each leg.' },
    dumbbells: { id: 'mountain-climber', name: 'Mountain Climbers', kind: 'interval', unit: 'reps', cue: 'Fast knees. Count each leg.' },
    bodyweight: { id: 'mountain-climber', name: 'Mountain Climbers', kind: 'interval', unit: 'reps', cue: 'Fast knees. Count each leg.' },
  },
  walk: {
    gym: { id: 'brisk-walk', name: 'Brisk Walk / Easy Cardio', kind: 'cardio', unit: 'min', cue: 'Conversational pace. Log minutes.' },
    dumbbells: { id: 'brisk-walk', name: 'Brisk Walk / Easy Cardio', kind: 'cardio', unit: 'min', cue: 'Conversational pace. Log minutes.' },
    bodyweight: { id: 'brisk-walk', name: 'Brisk Walk / Easy Cardio', kind: 'cardio', unit: 'min', cue: 'Conversational pace. Log minutes.' },
  },
  mobility: {
    gym: { id: 'mobility', name: 'Mobility Flow', kind: 'cardio', unit: 'min', cue: 'Hips, hamstrings, shoulders, upper back.' },
    dumbbells: { id: 'mobility', name: 'Mobility Flow', kind: 'cardio', unit: 'min', cue: 'Hips, hamstrings, shoulders, upper back.' },
    bodyweight: { id: 'mobility', name: 'Mobility Flow', kind: 'cardio', unit: 'min', cue: 'Hips, hamstrings, shoulders, upper back.' },
  },
}

const b = (slots: string[], sets: number, repMin: number, repMax: number, rest: number, work?: number): PlanBlock => ({
  slots, sets, repMin, repMax, rest, work,
})

export const PLANS: Plan[] = [
  {
    id: 'strength-a',
    name: 'Strength A',
    type: 'strength',
    blurb: 'Squat + push, hinge + pull supersets, then a sprint finisher.',
    blocks: [b(['squat', 'hpush'], 3, 8, 12, 45), b(['hinge', 'hpull'], 3, 8, 12, 45), b(['finisher'], 6, 0, 0, 30, 20)],
  },
  {
    id: 'conditioning',
    name: 'Heart & Lungs',
    type: 'conditioning',
    blurb: 'Intervals that push your cardio, then a short circuit.',
    blocks: [b(['intervals'], 8, 0, 0, 60, 30), b(['circuit1', 'circuit2'], 4, 0, 0, 15, 30)],
  },
  {
    id: 'strength-b',
    name: 'Strength B',
    type: 'strength',
    blurb: 'Lunge + press, deadlift + pull supersets, core and carries.',
    blocks: [b(['lunge', 'vpush'], 3, 8, 12, 45), b(['deadlift', 'vpull'], 3, 6, 10, 60), b(['core', 'carry'], 2, 30, 60, 30)],
  },
  {
    id: 'easy',
    name: 'Easy Day',
    type: 'easy',
    blurb: 'Walk + mobility. Still counts for your streak. Recovery is training.',
    blocks: [b(['walk'], 1, 20, 40, 0), b(['mobility'], 1, 5, 10, 0)],
  },
]

/** Not in the rotation: the bare minimum for a busy day. Keeps the phoenix alive (40 XP), the bank covers the rest. */
export const MINIMUM: Plan = {
  id: 'minimum',
  name: '10-Min Minimum',
  type: 'strength',
  blurb: 'Busy day? Two quick supersets and a finisher. Worth 40 XP.',
  blocks: [b(['squat', 'hpush'], 2, 8, 12, 30), b(['finisher'], 4, 0, 0, 20, 20)],
}

/** Rotation: A, cardio, B, easy, repeat. */
export const ROTATION = ['strength-a', 'conditioning', 'strength-b', 'easy']

export const planById = (id: string) => (id === MINIMUM.id ? MINIMUM : (PLANS.find((p) => p.id === id) ?? PLANS[0]))

export const exerciseFor = (slot: string, eq: Equipment): Exercise => SLOTS[slot][eq]

export interface Step {
  blockIndex: number
  slot: string
  exercise: Exercise
  setNo: number
  sets: number
  block: PlanBlock
}

/** Flatten a plan into ordered steps. Supersets alternate: A1 B1 A2 B2 ... */
export function planSteps(plan: Plan, eq: Equipment): Step[] {
  const out: Step[] = []
  plan.blocks.forEach((block, blockIndex) => {
    for (let s = 1; s <= block.sets; s++) {
      for (const slot of block.slots) {
        out.push({ blockIndex, slot, exercise: exerciseFor(slot, eq), setNo: s, sets: block.sets, block })
      }
    }
  })
  return out
}

export function nextPlanId(lastPlanId: string | undefined) {
  if (!lastPlanId || !ROTATION.includes(lastPlanId)) return ROTATION[0]
  const i = ROTATION.indexOf(lastPlanId)
  return ROTATION[(i + 1) % ROTATION.length]
}

/** Next plan in the rotation, ignoring minimum days. */
export const suggestedPlanId = (workouts: { planId: string }[]) =>
  nextPlanId([...workouts].reverse().find((w) => ROTATION.includes(w.planId))?.planId)
