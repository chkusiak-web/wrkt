import type { Equipment, Exercise, Muscle, Plan, PlanBlock } from '../types'

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
  incline: {
    gym: { id: 'db-incline', name: 'Incline Dumbbell Press', kind: 'weighted', cue: 'Bench at 30°, press up and slightly back.' },
    dumbbells: { id: 'db-incline', name: 'Incline Dumbbell Press', kind: 'weighted', cue: 'Bench at 30°, press up and slightly back.' },
    bodyweight: { id: 'bw-decline-pushup', name: 'Decline Push-up', kind: 'reps', cue: 'Feet up on a chair, body straight.' },
  },
  reardelt: {
    gym: { id: 'face-pull', name: 'Face Pull', kind: 'weighted', cue: 'Pull rope to eyes, elbows high.' },
    dumbbells: { id: 'db-rear-fly', name: 'Rear Delt Fly', kind: 'weighted', cue: 'Hinge over, light weight, squeeze back.' },
    bodyweight: { id: 'bw-superman', name: 'Prone Y-T Raise', kind: 'reps', cue: 'Lying face down, lift arms, squeeze back.' },
  },
  stepup: {
    gym: { id: 'db-stepup', name: 'Dumbbell Step-up', kind: 'weighted', cue: 'Whole foot on the box, drive through heel. Reps per leg.' },
    dumbbells: { id: 'db-stepup', name: 'Dumbbell Step-up', kind: 'weighted', cue: 'Whole foot on the box, drive through heel. Reps per leg.' },
    bodyweight: { id: 'bw-stepup', name: 'Step-up', kind: 'reps', cue: 'Sturdy chair or stair. Reps per leg.' },
  },
  hipthrust: {
    gym: { id: 'bb-hip-thrust', name: 'Barbell Hip Thrust', kind: 'weighted', cue: 'Chin tucked, squeeze glutes hard at top.' },
    dumbbells: { id: 'db-hip-thrust', name: 'Dumbbell Hip Thrust', kind: 'weighted', cue: 'Chin tucked, squeeze glutes hard at top.' },
    bodyweight: { id: 'bw-glute-bridge-2', name: 'Glute Bridge', kind: 'reps', cue: 'Squeeze at top 1 sec.' },
  },
  abs: {
    gym: { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', kind: 'reps', cue: 'No swinging. Curl hips up.' },
    dumbbells: { id: 'bw-dead-bug', name: 'Dead Bug', kind: 'reps', cue: 'Low back pressed down. Reps per side.' },
    bodyweight: { id: 'bw-dead-bug', name: 'Dead Bug', kind: 'reps', cue: 'Low back pressed down. Reps per side.' },
  },
  calves: {
    gym: { id: 'calf-raise', name: 'Standing Calf Raise', kind: 'weighted', cue: 'Full stretch at the bottom, pause at the top.' },
    dumbbells: { id: 'db-calf-raise', name: 'Dumbbell Calf Raise', kind: 'weighted', cue: 'Full stretch at the bottom, pause at the top.' },
    bodyweight: { id: 'bw-calf-raise', name: 'Single-leg Calf Raise', kind: 'reps', cue: 'Hold a wall. Reps per leg.' },
  },
  skater: {
    gym: { id: 'skater', name: 'Skater Hops', kind: 'interval', unit: 'reps', cue: 'Side to side, land soft. Log reps per round.' },
    dumbbells: { id: 'skater', name: 'Skater Hops', kind: 'interval', unit: 'reps', cue: 'Side to side, land soft. Log reps per round.' },
    bodyweight: { id: 'skater', name: 'Skater Hops', kind: 'interval', unit: 'reps', cue: 'Side to side, land soft. Log reps per round.' },
  },
  climb: {
    gym: { id: 'stair-intervals', name: 'Stair Climber Intervals', kind: 'interval', unit: 'level', cue: 'Hard = a few words only. Rate effort 1-10.' },
    dumbbells: { id: 'hill-repeats', name: 'Stair / Hill Repeats', kind: 'interval', unit: 'level', cue: 'Hard up, walk down. Rate effort 1-10.' },
    bodyweight: { id: 'hill-repeats', name: 'Stair / Hill Repeats', kind: 'interval', unit: 'level', cue: 'Hard up, walk down. Rate effort 1-10.' },
  },
}

const b = (slots: string[], sets: number, repMin: number, repMax: number, rest: number, work?: number): PlanBlock => ({
  slots, sets, repMin, repMax, rest, work,
})

/** Every workout ends with 5-8 min of cardio. */
export const PLANS: Plan[] = [
  {
    id: 'strength-a',
    name: 'Full Body A',
    type: 'strength',
    blurb: 'Squat + push, hinge + pull supersets, then bike sprints.',
    blocks: [b(['squat', 'hpush'], 3, 8, 12, 45), b(['hinge', 'hpull'], 3, 8, 12, 45), b(['finisher'], 6, 0, 0, 30, 20)],
  },
  {
    id: 'strength-b',
    name: 'Full Body B',
    type: 'strength',
    blurb: 'Lunge + press, deadlift + pull, core and carries, then intervals.',
    blocks: [b(['lunge', 'vpush'], 3, 8, 12, 45), b(['deadlift', 'vpull'], 3, 6, 10, 60), b(['core', 'carry'], 2, 30, 60, 30), b(['intervals'], 5, 0, 0, 40, 30)],
  },
  {
    id: 'conditioning',
    name: 'Legs + Lungs',
    type: 'strength',
    blurb: 'Squats and rows, then a longer interval finish.',
    blocks: [b(['squat', 'hpull'], 3, 8, 12, 45), b(['lunge', 'core'], 2, 10, 12, 30), b(['intervals'], 6, 0, 0, 40, 30)],
  },
  {
    id: 'upper',
    name: 'Upper Body',
    type: 'strength',
    blurb: 'Chest, back and shoulders, then sprints.',
    blocks: [b(['hpush', 'hpull'], 3, 8, 12, 45), b(['vpush', 'vpull'], 3, 8, 12, 45), b(['incline', 'reardelt'], 2, 10, 15, 30), b(['finisher'], 6, 0, 0, 30, 20)],
  },
  {
    id: 'lower',
    name: 'Lower Body',
    type: 'strength',
    blurb: 'Squat, hinge, single-leg and calves, then climbing intervals.',
    blocks: [b(['squat', 'abs'], 4, 6, 10, 60), b(['hinge', 'stepup'], 3, 8, 12, 45), b(['hipthrust', 'calves'], 2, 10, 15, 30), b(['climb'], 5, 0, 0, 40, 40)],
  },
  {
    id: 'heavy',
    name: 'Heavy Day',
    type: 'strength',
    blurb: 'Fewer reps, more weight, longer rest. Short sprint finish.',
    blocks: [b(['squat', 'hpull'], 5, 4, 6, 75), b(['deadlift', 'vpush'], 4, 4, 6, 75), b(['finisher'], 5, 0, 0, 40, 20)],
  },
  {
    id: 'burn',
    name: 'High-Rep Burn',
    type: 'strength',
    blurb: 'Lighter weight, 15-20 reps, short rest, swing finisher.',
    blocks: [b(['squat', 'hpush'], 2, 15, 20, 30), b(['lunge', 'hpull'], 2, 15, 20, 30), b(['vpush', 'hipthrust'], 2, 15, 20, 30), b(['circuit1'], 6, 0, 0, 20, 30)],
  },
  {
    id: 'circuit',
    name: 'Full-Body Circuit',
    type: 'strength',
    blurb: 'Four moves back to back, three rounds, then skaters.',
    blocks: [b(['squat', 'hpush', 'hpull', 'circuit1'], 3, 10, 15, 15), b(['lunge', 'vpush', 'abs', 'circuit2'], 3, 10, 15, 15), b(['skater'], 5, 0, 0, 30, 30)],
  },
  {
    id: 'sprints',
    name: 'Push + Sprints',
    type: 'strength',
    blurb: 'Press and hinge, pull and abs, then eight sprints.',
    blocks: [b(['hpush', 'hinge'], 3, 8, 12, 45), b(['vpull', 'abs'], 2, 10, 15, 30), b(['finisher'], 8, 0, 0, 40, 20)],
  },
  {
    id: 'hills',
    name: 'Pull + Hills',
    type: 'strength',
    blurb: 'Pulls, step-ups and calves, then stairs or hills.',
    blocks: [b(['vpull', 'stepup'], 3, 8, 12, 45), b(['reardelt', 'calves'], 2, 12, 15, 30), b(['climb'], 5, 0, 0, 45, 45)],
  },
  {
    id: 'zone2',
    name: 'Strength + Zone 2',
    type: 'strength',
    blurb: 'Lunges, presses and core, then steady cardio you could talk through.',
    blocks: [b(['lunge', 'vpush'], 3, 8, 12, 45), b(['core', 'abs'], 2, 30, 45, 20), b(['walk'], 1, 6, 8, 0)],
  },
  {
    id: 'easy',
    name: 'Easy Day',
    type: 'easy',
    blurb: 'Walk + mobility. Still counts for your streak. Recovery is training.',
    blocks: [b(['walk'], 1, 20, 40, 0), b(['mobility'], 1, 5, 10, 0)],
  },
  {
    id: 'mobility',
    name: 'Recovery Flow',
    type: 'easy',
    blurb: 'Long mobility session plus an easy walk. For sore days.',
    blocks: [b(['mobility'], 1, 15, 20, 0), b(['walk'], 1, 10, 15, 0)],
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

export const planById = (id: string) => (id === MINIMUM.id ? MINIMUM : (PLANS.find((p) => p.id === id) ?? PLANS[0]))

/** Rough minutes: ~40 s per set (or the interval work time) plus rest. */
export function estimateMin(plan: Plan) {
  let sec = 0
  for (const bl of plan.blocks) {
    const n = bl.sets * bl.slots.length
    if (bl.slots.length === 1 && (bl.repMin >= 5 && !bl.work && bl.rest === 0)) sec += ((bl.repMin + bl.repMax) / 2) * 60
    else sec += n * ((bl.work ?? 40) + bl.rest)
  }
  return Math.round(sec / 60)
}

/** A slot can pin one equipment's version, e.g. "vpush@dumbbells" for the dumbbell press at a gym. */
export const baseSlot = (slot: string) => slot.split('@')[0]
export const exerciseFor = (slot: string, eq: Equipment): Exercise => {
  const [b, pin] = slot.split('@')
  return SLOTS[b][(pin as Equipment) || eq]
}

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

/** Muscles each movement slot works: 1 = main, 0.5 = helper. Cardio slots work the heart, not listed here. */
export const SLOT_MUSCLES: Record<string, Partial<Record<Muscle, number>>> = {
  squat: { quads: 1, glutes: 0.5, core: 0.5 },
  hpush: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  hinge: { hamstrings: 1, glutes: 0.5 },
  hpull: { back: 1, biceps: 0.5 },
  lunge: { quads: 1, glutes: 0.5, calves: 0.5 },
  vpush: { shoulders: 1, triceps: 0.5 },
  vpull: { back: 1, biceps: 0.5 },
  deadlift: { glutes: 1, hamstrings: 0.5, back: 0.5, quads: 0.5 },
  core: { core: 1 },
  carry: { core: 0.5, back: 0.5 },
  incline: { chest: 1, shoulders: 0.5, triceps: 0.5 },
  reardelt: { shoulders: 1, back: 0.5 },
  stepup: { quads: 1, glutes: 0.5, calves: 0.5 },
  hipthrust: { glutes: 1, hamstrings: 0.5 },
  abs: { core: 1 },
  calves: { calves: 1 },
  climb: { calves: 0.5 },
}

/** Lifting slots the coach may swap between. */
export const STRENGTH_SLOTS = Object.keys(SLOT_MUSCLES).filter((s) => s !== 'climb')

type M = Partial<Record<Muscle, number>>
const lib = (id: string, name: string, muscles: M, cue: string, kind: Exercise['kind'] = 'weighted', unit?: string) => ({ id, name, muscles, cue, kind, unit })
/** Extra moves you can swap in from search. Same move for every equipment setup. */
const LIBRARY = [
  lib('db-seated-press', 'Seated Dumbbell Shoulder Press', { shoulders: 1, triceps: 0.5 }, 'Back on the bench, press up, elbows slightly forward.'),
  lib('machine-shoulder-press', 'Machine Shoulder Press', { shoulders: 1, triceps: 0.5 }, 'Handles at shoulder height, press up, slow down.'),
  lib('arnold-press', 'Arnold Press', { shoulders: 1, triceps: 0.5 }, 'Palms in at the bottom, rotate out as you press.'),
  lib('lateral-raise', 'Lateral Raise', { shoulders: 1 }, 'Light weight, lead with elbows, stop at shoulder height.'),
  lib('machine-chest-press', 'Machine Chest Press', { chest: 1, triceps: 0.5, shoulders: 0.5 }, 'Shoulder blades back, press and control.'),
  lib('chest-fly', 'Cable / Dumbbell Fly', { chest: 1 }, 'Soft elbows, hug a big tree, squeeze.'),
  lib('dips', 'Dips', { triceps: 1, chest: 0.5 }, 'Lean slightly forward, elbows back. Assist if needed.', 'reps'),
  lib('pullup', 'Pull-up', { back: 1, biceps: 0.5 }, 'Full hang, chest to bar. Use assist or a band if needed.', 'reps'),
  lib('assisted-pullup', 'Assisted Pull-up Machine', { back: 1, biceps: 0.5 }, 'Log the assist weight. Less assist is progress.'),
  lib('chest-row', 'Chest-Supported Row', { back: 1, biceps: 0.5 }, 'Chest on the pad, pull elbows back.'),
  lib('db-shrug', 'Dumbbell Shrug', { back: 1 }, 'Straight up, pause, no rolling.'),
  lib('db-curl', 'Dumbbell Curl', { biceps: 1 }, 'Elbows pinned, no swinging.'),
  lib('hammer-curl', 'Hammer Curl', { biceps: 1 }, 'Thumbs up, elbows pinned.'),
  lib('cable-curl', 'Cable Curl', { biceps: 1 }, 'Elbows pinned, squeeze at the top.'),
  lib('tri-pushdown', 'Tricep Pushdown', { triceps: 1 }, 'Elbows at your sides, lock out.'),
  lib('overhead-tri', 'Overhead Tricep Extension', { triceps: 1 }, 'Elbows up and in, full stretch.'),
  lib('leg-press', 'Leg Press', { quads: 1, glutes: 0.5 }, 'Feet shoulder width, knees track toes, no lockout.'),
  lib('leg-extension', 'Leg Extension', { quads: 1 }, 'Pause at the top, slow down.'),
  lib('leg-curl', 'Leg Curl', { hamstrings: 1 }, 'Hips down, curl and squeeze.'),
  lib('bulgarian', 'Bulgarian Split Squat', { quads: 1, glutes: 0.5 }, 'Back foot on a bench. Reps per leg.'),
  lib('smith-squat', 'Smith Machine Squat', { quads: 1, glutes: 0.5, core: 0.5 }, 'Feet a bit forward, sit down between your hips.'),
  lib('back-extension', 'Back Extension', { glutes: 1, hamstrings: 0.5, back: 0.5 }, 'Hinge at the hips, squeeze glutes at the top.', 'reps'),
  lib('hip-abduction', 'Hip Abduction Machine', { glutes: 1 }, 'Push out, pause, slow back.'),
  lib('cable-kickback', 'Cable Glute Kickback', { glutes: 1 }, 'Kick back and up, squeeze. Reps per leg.'),
  lib('seated-calf', 'Seated Calf Raise', { calves: 1 }, 'Full stretch, pause at the top.'),
  lib('cable-crunch', 'Cable Crunch', { core: 1 }, 'Curl ribs to hips, hips stay still.'),
  lib('russian-twist', 'Russian Twist', { core: 1 }, 'Lean back, rotate side to side. Count both sides.', 'reps'),
  lib('ab-wheel', 'Ab Wheel Rollout', { core: 1 }, 'Ribs down, roll only as far as you can control.', 'reps'),
  lib('side-plank', 'Side Plank', { core: 1 }, 'Hips high. Seconds per side.', 'hold', 'sec'),
]
for (const x of LIBRARY) {
  const ex: Exercise = { id: x.id, name: x.name, kind: x.kind, cue: x.cue, ...(x.unit ? { unit: x.unit } : {}) }
  SLOTS[x.id] = { gym: ex, dumbbells: ex, bodyweight: ex }
  SLOT_MUSCLES[x.id] = x.muscles
}
/** Everything you can swap in from search: the coach's slots plus the library. */
export const LIFT_SLOTS = [...STRENGTH_SLOTS, ...LIBRARY.map((x) => x.id)]
/** The other equipment versions of a slot, pinned, e.g. the dumbbell press while at the gym. */
export const variantsOf = (slot: string, eq: Equipment) =>
  (['gym', 'dumbbells', 'bodyweight'] as Equipment[])
    .filter((e) => e !== eq && SLOTS[slot]?.[e] && SLOTS[slot][e].id !== SLOTS[slot][eq].id)
    .map((e) => `${slot}@${e}`)

export const slotMuscles = (slot: string): M => SLOT_MUSCLES[baseSlot(slot)] ?? {}
export const primaryMuscle = (slot: string): Muscle | undefined =>
  (Object.entries(slotMuscles(slot)) as [Muscle, number][]).sort((a, b) => b[1] - a[1])[0]?.[0]

const SLOT_BY_EXERCISE = new Map<string, string>()
const EXERCISE_BY_ID = new Map<string, Exercise>()
for (const [slot, byEq] of Object.entries(SLOTS))
  for (const ex of Object.values(byEq)) {
    if (!SLOT_BY_EXERCISE.has(ex.id)) SLOT_BY_EXERCISE.set(ex.id, slot)
    if (!EXERCISE_BY_ID.has(ex.id)) EXERCISE_BY_ID.set(ex.id, ex)
  }
export const slotOfExercise = (id: string) => SLOT_BY_EXERCISE.get(id)
export const exerciseById = (id: string) => EXERCISE_BY_ID.get(id)

/** The plan an active workout is running, including any swaps. */
export const activePlan = (a: { planId: string; blocks?: PlanBlock[] }): Plan => {
  const base = planById(a.planId)
  return a.blocks ? { ...base, blocks: a.blocks } : base
}

/** Cardio slots: intervals and steady work. Finishers swap among these. */
export const CARDIO_SLOTS = ['finisher', 'intervals', 'circuit1', 'circuit2', 'skater', 'climb', 'walk', 'mobility']

/** A block that's all cardio (intervals or steady minutes). */
export const isCardioBlock = (bl: PlanBlock) => bl.slots.every((s) => CARDIO_SLOTS.includes(baseSlot(s)))

/** Where the cardio finisher starts: the trailing cardio blocks after the lifting. */
export function finisherStart(blocks: PlanBlock[]) {
  let k = blocks.length
  while (k > 0 && isCardioBlock(blocks[k - 1])) k--
  return k === 0 ? blocks.length : k
}

/** Minutes a cardio block takes. */
export const cardioMinutes = (bl: PlanBlock) => (bl.work ? Math.max(1, Math.round((bl.sets * (bl.work + bl.rest)) / 60)) : bl.repMin)

export const moveCount = (p: Plan) => p.blocks.reduce((a, bl) => a + bl.slots.length, 0)
