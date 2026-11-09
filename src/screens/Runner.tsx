import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ActiveWorkout, ExerciseKind, PlanBlock, SetLog, WorkoutLog } from '../types'
import { getState, setState, useStore } from '../lib/store'
import { MINIMUM, activePlan, cardioMinutes, exerciseById, exerciseFor, finisherStart, isCardioBlock, planSteps, primaryMuscle, type Step } from '../lib/plans'
import { MUSCLE_LABEL, muscleStates, swapOptions } from '../lib/coach'
import { e1rm, lastSetsFor, newPRs, targetFor, volume } from '../lib/progress'
import { workoutBonuses, workoutUpkeep, type PhoenixState } from '../lib/xp'
import { fmtClock, today, uid } from '../lib/date'
import { beep, keepAwake, unlockAudio } from '../lib/fx'
import { useNow } from '../lib/useNow'
import { useNav } from '../nav'
import { Led } from '../led/Led'
import { FLAME_REF } from '../led/engine'
import { Back, Bar, Bottom, HoldBtn, Label, LedStepper, Screen, useReorder } from '../components/kit'
import Bird from '../components/Bird'
import SwapList from './SwapList'

const GOAL_MIN = 30

type Phase =
  | { k: 'auto' }
  | { k: 'log' }
  | { k: 'rest'; endAt: number; total: number }
  | { k: 'exdone'; exId: string; block: number }
  | { k: 'done' }
  | { k: 'mid' }
  | { k: 'swap' }

const isCardioKind = (k: ExerciseKind) => k === 'interval' || k === 'cardio'
const unitOf = (s: Step) => s.exercise.unit ?? (s.exercise.kind === 'hold' ? 'sec' : 'reps')
const fmtSet = (s: Pick<SetLog, 'weight' | 'reps'>, unit = 'reps') => (s.weight ? `${s.weight} × ${s.reps}` : `${s.reps} ${unit}`)

function nextIndex(steps: Step[], from: number, skipped: number[]) {
  let i = from
  while (i < steps.length && skipped.includes(i)) i++
  return i
}

const update = (fn: (a: ActiveWorkout) => ActiveWorkout) => setState((s) => (s.active ? { ...s, active: fn(s.active) } : s))

export default function Runner({ p }: { p: PhoenixState }) {
  const active = useStore((s) => s.active)
  const nav = useNav()
  useEffect(() => {
    if (!active) nav.reset({ s: 'home' })
  }, [active, nav])
  useEffect(() => {
    void keepAwake(true)
    return () => void keepAwake(false)
  }, [])
  if (!active) return null
  return <Run active={active} p={p} />
}

function Run({ active, p }: { active: ActiveWorkout; p: PhoenixState }) {
  const nav = useNav()
  const history = useStore((s) => s.workouts)
  const restScale = useStore((s) => s.profile?.restScale ?? 1)
  const plan = useMemo(() => activePlan(active), [active])
  const steps = useMemo(() => planSteps(plan, active.equipment), [plan, active.equipment])
  const now = useNow(250)
  const [phase, setPhase] = useState<Phase>({ k: 'auto' })
  const idx = nextIndex(steps, active.step, active.skipped)
  const step: Step | undefined = steps[idx]
  const target = step ? targetFor(step.exercise, step.block, step.setNo, history) : null
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [rating, setRating] = useState<'easy' | 'hard' | undefined>(undefined)
  const beeped = useRef(-1)

  // prefill with the target (or the weight you just used) when the move changes
  const prefillKey = step ? `${idx}:${step.exercise.id}` : ''
  useEffect(() => {
    if (!step || !target) return
    const prevSame = [...active.sets].reverse().find((s) => s.exerciseId === step.exercise.id)
    setWeight(prevSame?.weight || target.weight)
    setReps(prevSame && step.exercise.kind !== 'weighted' ? prevSame.reps : target.reps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey])

  // rest timer: beeps on the last three seconds, then on to the next set
  useEffect(() => {
    if (phase.k !== 'rest') return
    const left = Math.ceil((phase.endAt - now) / 1000)
    if (left <= 3 && left > 0 && beeped.current !== left) {
      beeped.current = left
      beep(1, 660)
    }
    if (now >= phase.endAt) {
      beeped.current = -1
      beep(2, 990)
      setPhase({ k: 'auto' })
    }
  }, [now, phase])

  const elapsed = (now - active.start) / 1000
  const clock = <span className="clock">{fmtClock(elapsed)}</span>
  const end = () => setPhase({ k: 'done' })
  const top = (planLink = true) => (
    <Bar
      left={clock}
      right={
        <>
          {planLink && <button className="link pad" onClick={() => setPhase({ k: 'mid' })}>Plan</button>}
          <button className="link pad-l" onClick={end}>End</button>
        </>
      }
    />
  )

  if (phase.k === 'exdone') return <ExerciseDone exId={phase.exId} block={plan.blocks[phase.block]} active={active} history={history} clock={clock} planName={plan.name} onEnd={end} onNext={() => setPhase({ k: 'auto' })} />

  if (phase.k === 'done' || !step) return <DoneView active={active} steps={steps} p={p} rating={rating} setRating={setRating} allDone={!step} onResume={() => setPhase({ k: 'auto' })} onMore={() => {
    const strength = plan.blocks.filter((b) => !isCardioBlock(b))
    const last = strength[strength.length - 1] ?? plan.blocks[0]
    update((a) => ({ ...a, blocks: [...activePlan(a).blocks, { ...last, slots: [last.slots[0]], sets: 1 }] }))
    setPhase({ k: 'log' })
  }} onSave={() => {
    if (!active.sets.length) setState((st) => ({ ...st, active: null }))
    else saveWorkout(rating)
    nav.reset({ s: 'home' })
  }} />

  if (phase.k === 'mid') return <MidPlan active={active} step={step} onDone={() => setPhase({ k: 'auto' })} />

  if (phase.k === 'swap')
    return (
      <SwapList
        slot={step.slot}
        inPlan={plan.blocks.flatMap((b) => b.slots)}
        eq={active.equipment}
        ms={muscleStates(getState())}
        backLabel="Plan"
        onBack={() => setPhase({ k: 'auto' })}
        onPick={(to) => {
          // swap this move for the rest of the workout; recovery uses what was logged, so tomorrow adapts
          update((a) => ({ ...a, blocks: activePlan(a).blocks.map((bl, i) => (i === step.blockIndex ? { ...bl, slots: bl.slots.map((sl) => (sl === step.slot ? to : sl)) } : bl)) }))
          setPhase({ k: 'auto' })
        }}
      />
    )

  if (phase.k === 'rest') {
    const secs = Math.max(0, Math.ceil((phase.endAt - now) / 1000))
    const nt = targetFor(step.exercise, step.block, step.setNo, history)
    return (
      <RestView
        secs={secs}
        total={phase.total}
        clock={clock}
        name={step.exercise.name}
        sub={step.exercise.kind === 'weighted' && weight ? `${weight} × ${nt.reps}` : `${nt.reps || reps} ${unitOf(step)}`}
        onEnd={end}
        onSkip={() => setPhase({ k: 'auto' })}
        onMore={() => {
          update((a) => ({ ...a, overruns: (a.overruns ?? 0) + 1 }))
          setPhase({ ...phase, endAt: phase.endAt + 15000, total: phase.total + 15 })
        }}
      />
    )
  }

  if (isCardioKind(step.exercise.kind)) return <Finisher key={step.blockIndex} step={step} steps={steps} idx={idx} history={history} top={top()} />

  // ---- lifting: goals before the first set, then log each set ----
  const unit = unitOf(step)
  const weighted = step.exercise.kind === 'weighted'
  const goals = phase.k === 'auto' && step.setNo === 1
  const moves = [...new Set(steps.filter((s) => !isCardioKind(s.exercise.kind)).map((s) => `${s.blockIndex}:${s.slot}`))]
  const ord = moves.indexOf(`${step.blockIndex}:${step.slot}`) + 1
  const lastSet = step.setNo >= step.sets

  const doneSet = () => {
    unlockAudio()
    const set: SetLog = { exerciseId: step.exercise.id, weight: weighted ? weight : 0, reps, ts: Date.now() }
    update((a) => ({ ...a, sets: [...a.sets, set], step: idx + 1 }))
    if (lastSet) return setPhase({ k: 'exdone', exId: step.exercise.id, block: step.blockIndex })
    const rest = Math.round(step.block.rest * restScale)
    const more = nextIndex(steps, idx + 1, active.skipped) < steps.length
    setPhase(more && rest > 0 ? { k: 'rest', endAt: Date.now() + rest * 1000, total: rest } : { k: 'auto' })
  }
  const skipSet = () => {
    update((a) => ({ ...a, skipped: [...a.skipped, idx], step: idx + 1 }))
    setPhase({ k: 'auto' })
  }
  // skip the whole move: every set of it left in this block
  const skipMove = () => {
    const rest = steps.map((s, i) => (i >= idx && s.blockIndex === step.blockIndex && s.slot === step.slot ? i : -1)).filter((i) => i >= 0)
    update((a) => ({ ...a, skipped: [...a.skipped, ...rest], step: idx === a.step ? idx + 1 : a.step }))
  }
  const setSets = (n: number) => update((a) => ({ ...a, blocks: activePlan(a).blocks.map((bl, i) => (i === step.blockIndex ? { ...bl, sets: n } : bl)) }))

  return (
    <Screen>
      {top()}
      <Dots steps={steps} idx={idx} skipped={active.skipped} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {goals && <span className="muted" style={{ fontSize: 15 }}>{ord} / {moves.length}</span>}
        <span className="title lg">{step.exercise.name}</span>
        <span className="muted" style={{ fontSize: 15 }}>
          {target?.last ? `Last ${fmtSet(target.last, unit)}` : 'First time'}
          {step.block.slots.length > 1 ? ' · superset' : ''}
        </span>
      </div>
      <div className="steppers">
        {goals ? (
          <LedStepper label="sets" value={step.sets} onChange={setSets} min={1} max={10} fitStr="88" />
        ) : (
          <div className="lstep">
            <span className="lstep-l">set</span>
            <div className="lstep-row" style={{ position: 'relative' }}>
              <span style={{ width: 40 }} />
              <div className="led-box" style={{ width: 150, height: 64 }}>
                <Led cfg={{ fit: true, maxPitch: 8, bare: true, text: { str: String(step.setNo), fitStr: '88', S: 1 } }} label={`Set ${step.setNo} of ${step.sets}`} />
              </div>
              <span className="muted" style={{ width: 40, fontSize: 15 }}>of {step.sets}</span>
            </div>
          </div>
        )}
        <LedStepper label={unit} value={reps} onChange={setReps} step={unit === 'sec' ? 5 : 1} min={0} max={unit === 'sec' ? 600 : 300} fitStr="88" />
        {weighted && <LedStepper label="lb" value={weight} onChange={setWeight} step={5} min={0} max={995} fitStr="888" />}
      </div>
      {goals ? (
        <Bottom
          left={<button className="link pad-x" onClick={skipMove}>Skip</button>}
          main={<button className="btn primary" onClick={() => { unlockAudio(); setPhase({ k: 'log' }) }}>Start</button>}
          right={primaryMuscle(step.slot) ? <button className="link pad-x" onClick={() => setPhase({ k: 'swap' })}>Swap</button> : null}
        />
      ) : (
        <Bottom
          left={<button className="link pad-x" onClick={skipSet}>Skip</button>}
          main={<button className="btn primary" style={lastSet ? { width: 'auto', padding: '0 16px' } : undefined} onClick={doneSet}>{lastSet ? 'Next Exercise' : 'Next'}</button>}
        />
      )}
    </Screen>
  )
}

function Dots({ steps, idx, skipped }: { steps: Step[]; idx: number; skipped: number[] }) {
  return (
    <div className={`dots ${steps.length > 20 ? 'tight' : ''}`} role="img" aria-label={`${Math.min(idx, steps.length)} of ${steps.length} sets`}>
      {steps.map((_, i) => (
        <span key={i} className={i === idx ? 'cur' : i < idx && !skipped.includes(i) ? 'done' : ''} />
      ))}
    </div>
  )
}

function RestView({ secs, total, clock, name, sub, onEnd, onSkip, onMore }: { secs: number; total: number; clock: ReactNode; name: string; sub: string; onEnd: () => void; onSkip: () => void; onMore: () => void }) {
  const num = useRef<HTMLDivElement>(null)
  const done = 1 - secs / Math.max(1, total)
  return (
    <div className="scr rest" style={{ padding: 0 }}>
      {/* the flame climbs as the rest runs out */}
      <Led cfg={{ pitch: 7, flame: 0.97 - 0.35 * Math.max(0, Math.min(1, done)), fills: false, text: { str: String(Math.min(99, secs)), at: num, S: 3 } }} />
      <div style={{ position: 'absolute', top: 'var(--pad-top)', left: 20, right: 20 }}>
        <Bar left={clock} right={<button className="link pad-l" onClick={onEnd}>End</button>} />
      </div>
      <div ref={num} className="num-anchor" role="img" aria-label={`${secs} seconds left`} />
      <div className="what">
        <span style={{ fontSize: 24, fontWeight: 600 }}>{name}</span>
        <span className="small muted">{sub}</span>
      </div>
      <div className="btns">
        <button className="round big" onClick={onSkip}>Skip</button>
        <button className="round big" aria-label="Add 15 seconds" onClick={onMore}>+15 s</button>
      </div>
    </div>
  )
}

function ExerciseDone({ exId, block, active, history, clock, planName, onEnd, onNext }: { exId: string; block?: PlanBlock; active: ActiveWorkout; history: WorkoutLog[]; clock: ReactNode; planName: string; onEnd: () => void; onNext: () => void }) {
  const ex = exerciseById(exId)
  const sets = active.sets.filter((s) => s.exerciseId === exId)
  const last = lastSetsFor(history, exId)
  const unit = ex?.unit ?? (ex?.kind === 'hold' ? 'sec' : 'reps')
  const pr = newPRs(history, sets)[0]
  const beats = sets.filter((s, i) => last[i] && e1rm(s.weight, s.reps) > e1rm(last[i].weight, last[i].reps)).length
  const xp = beats * 5 + (pr ? 25 : 0)
  let next = ''
  if (pr && ex && block) {
    const t = targetFor(ex, block, 1, [...history, { sets } as WorkoutLog])
    next = ex.kind === 'weighted' && t.weight > pr.weight ? `next ${t.weight} lb` : `next ${t.reps} ${unit}`
  }
  return (
    <Screen scroll>
      <Bar left={<span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>{clock}<span className="muted" style={{ fontSize: 15 }}>{planName}</span></span>} right={<button className="link pad-l" onClick={onEnd}>End</button>} />
      <span className="title lg">{ex?.name ?? 'Done'}</span>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <div className="led-box" style={{ width: 300, maxWidth: '100%', height: 64 }}>
          <Led
            cfg={xp ? { fit: true, maxPitch: 8, bare: true, text: { count: { delay: 350, to: xp, dur: 900, pre: '+', post: ' XP' }, fitStr: `+${xp} XP`, S: 1 } } : { fit: true, maxPitch: 8, bare: true, text: { str: 'DONE', S: 1 } }}
            label={xp ? `Plus ${xp} XP` : 'Done'}
          />
        </div>
      </div>
      <div className="table">
        <div className="tr th"><span>#</span><span>Today</span><span>Last</span><span /></div>
        {sets.map((s, i) => (
          <div className="tr" key={i}>
            <span className="muted">{i + 1}</span>
            <span>{fmtSet(s, unit)}</span>
            <span className="muted">{last[i] ? fmtSet(last[i], unit) : '—'}</span>
            <span className="mk">{pr === s ? 'PR' : last[i] && e1rm(s.weight, s.reps) > e1rm(last[i].weight, last[i].reps) ? '▲' : ''}</span>
          </div>
        ))}
      </div>
      {pr && <div className="card" style={{ fontSize: 15, fontWeight: 500 }}>PR {fmtSet(pr, unit)}{next ? ` · ${next}` : ''}</div>}
      <div className="spacer" />
      <div className="bottom-c"><button className="btn primary" onClick={onNext}>Next</button></div>
    </Screen>
  )
}

/** Cardio finisher: a clock that runs down, the flame rising under it, and your total at the end. */
function Finisher({ step, steps, idx, history, top }: { step: Step; steps: Step[]; idx: number; history: WorkoutLog[]; top: ReactNode }) {
  const now = useNow(250)
  const [start] = useState(() => Date.now())
  const bl = step.block
  const ex = step.exercise
  const mine = steps.map((s, i) => (i >= idx && s.blockIndex === step.blockIndex ? i : -1)).filter((i) => i >= 0)
  const rounds = mine.length
  const period = (bl.work ?? 30) + bl.rest
  const total = ex.kind === 'interval' ? rounds * period : (step.block.repMin || 5) * 60
  const el = (now - start) / 1000
  const left = Math.max(0, total - el)
  const level = ex.unit === 'level'
  const last = lastSetsFor(history, ex.id)
  const lastTotal = last.reduce((a, s) => a + s.reps, 0)
  const [out, setOut] = useState(() => (ex.kind === 'cardio' ? cardioMinutes(bl) : level ? last[0]?.reps || 7 : lastTotal ? lastTotal + 1 : 0))
  const r = Math.min(rounds, Math.floor(el / period) + 1)
  const work = ex.kind === 'interval' && el % period < (bl.work ?? 30) && el < total
  const cue = ex.kind === 'interval' ? (el >= total ? 'done' : `${r}/${rounds} · ${work ? 'go' : 'easy'}`) : ''
  const said = useRef('')
  useEffect(() => {
    // a beep on every switch between hard and easy, three at the end
    const k = el >= total ? 'end' : ex.kind === 'interval' ? `${r}:${work}` : ''
    if (said.current && k !== said.current) beep(k === 'end' ? 3 : work ? 2 : 1, work ? 990 : 660)
    said.current = k
  }, [el, total, r, work, ex.kind])

  const unit = ex.kind === 'cardio' ? 'min' : level ? 'effort' : `total ${ex.unit ?? 'reps'}`
  const finish = () => {
    const ts = Date.now()
    const sets: SetLog[] =
      ex.kind === 'cardio' || rounds === 1
        ? [{ exerciseId: ex.id, weight: 0, reps: out, ts }]
        : mine.map((_, k) => ({ exerciseId: ex.id, weight: 0, reps: level ? out : Math.floor(out / rounds) + (k < out % rounds ? 1 : 0), ts: ts + k }))
    // a steady block logs once but covers all its steps
    update((a) => ({ ...a, sets: [...a.sets, ...sets], skipped: ex.kind === 'cardio' ? [...a.skipped, ...mine.slice(1)] : a.skipped, step: mine[mine.length - 1] + 1 }))
  }
  const skip = () => update((a) => ({ ...a, skipped: [...a.skipped, ...mine], step: mine[mine.length - 1] + 1 }))
  const shown = ex.kind === 'cardio' && left === 0 ? el - total : left

  return (
    <Screen>
      <Led className="fin-flame" cfg={{ pitch: 7, bare: true, flame: 0.86 - 0.3 * Math.min(1, el / total), fills: false }} />
      <div className="over">{top}</div>
      <div className="over" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="muted" style={{ fontSize: 15 }}>Cardio finisher{cue ? ` · ${cue}` : ''}</span>
        <span className="title lg">{ex.name}</span>
      </div>
      <div className="over grow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <div className="led-box" style={{ width: 300, maxWidth: '100%', height: 96 }}>
          <Led cfg={{ fit: true, maxPitch: 9, bare: true, fills: false, text: { str: fmtClock(shown), fitStr: '8:88', S: 1 } }} label={`${fmtClock(shown)} ${ex.kind === 'cardio' && left === 0 ? 'over' : 'left'}`} />
        </div>
        <div className="mini-step">
          <HoldBtn className="round sm" label={`Less ${unit}`} onStep={() => setOut((v) => Math.max(0, v - 1))}>−</HoldBtn>
          <b>{out}</b>
          <HoldBtn className="round sm" label={`More ${unit}`} onStep={() => setOut((v) => Math.min(level ? 10 : 999, v + 1))}>+</HoldBtn>
          <span>{unit}</span>
        </div>
      </div>
      <div className="over">
        <Bottom left={<button className="btn" onClick={skip}>Skip</button>} main={<button className="btn primary solid" onClick={finish}>Done</button>} />
      </div>
    </Screen>
  )
}

/** Change the rest of the workout: sets now and later, order, drop or add moves. */
function MidPlan({ active, step, onDone }: { active: ActiveWorkout; step: Step; onDone: () => void }) {
  const plan = activePlan(active)
  const cur = step.blockIndex
  const done = step.setNo - 1
  const eq = active.equipment
  const setBlocks = (fn: (bl: PlanBlock[]) => PlanBlock[]) => update((a) => ({ ...a, blocks: fn(activePlan(a).blocks) }))
  const change = (i: number, fn: (b: PlanBlock) => PlanBlock | null) => setBlocks((bl) => bl.flatMap((b, j) => (j === i ? (fn(b) ? [fn(b)!] : []) : [b])))
  const handle = useReorder((from, to) =>
    setBlocks((bl) => {
      const i = cur + 1 + from
      const j = cur + 1 + to
      if (j <= cur || j >= bl.length) return bl
      const out = [...bl]
      ;[out[i], out[j]] = [out[j], out[i]]
      return out
    }),
  )
  const inPlan = plan.blocks.flatMap((bl) => bl.slots)
  const add = swapOptions('', inPlan, muscleStates(getState())).slice(0, 3)
  const names = (bl: PlanBlock) => bl.slots.map((sl) => exerciseFor(sl, eq).name).join(' + ')
  const sets = (i: number, bl: PlanBlock, minSets: number) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <button className="round sm" aria-label="Fewer sets" disabled={bl.sets <= minSets} onClick={() => change(i, (b) => ({ ...b, sets: Math.max(minSets, b.sets - 1) }))}>−</button>
      <span className="small num" style={{ minWidth: 44, textAlign: 'center' }}>{bl.sets} {bl.work ? 'rnds' : 'sets'}</span>
      <button className="round sm" aria-label="More sets" onClick={() => change(i, (b) => ({ ...b, sets: Math.min(10, b.sets + 1) }))}>+</button>
    </span>
  )
  const fin = finisherStart(plan.blocks)
  return (
    <Screen scroll>
      <Bar left={<Back label="Back" onClick={onDone} />} />
      <div className="title">Plan</div>
      <Label>Now</Label>
      <div className="rows">
        <div className="row">
          <span className="name">{names(plan.blocks[cur])}</span>
          {!isCardioBlock(plan.blocks[cur]) && sets(cur, plan.blocks[cur], Math.max(1, done + 1))}
        </div>
      </div>
      {cur + 1 < plan.blocks.length && <Label>Later</Label>}
      <div className="rows">
        {plan.blocks.slice(cur + 1).map((bl, k) => {
          const i = cur + 1 + k
          const cardio = isCardioBlock(bl)
          return (
            <div className="row" key={`${bl.slots.join('+')}:${i}`} data-drag="">
              <span className="handle" aria-hidden="true" {...handle(k)}>⋮⋮</span>
              <span className="name" style={{ fontSize: 15 }}>{names(bl)}{cardio ? ` · ${cardioMinutes(bl)} min` : ''}</span>
              {!cardio && sets(i, bl, 1)}
              {!cardio && <button className="link" style={{ padding: '0 4px', fontSize: 16 }} aria-label="Remove" onClick={() => change(i, () => null)}>×</button>}
            </div>
          )
        })}
      </div>
      {add.length > 0 && (
        <>
          <Label>Add · rested</Label>
          <div className="rows">
            {add.map((o) => (
              <div className="row" key={o.slot}>
                <span className="name" style={{ fontSize: 15 }}>{exerciseFor(o.slot, eq).name} <span className="sub">· {MUSCLE_LABEL[o.muscle]}</span></span>
                <button className="btn xs" aria-label="Add" onClick={() => setBlocks((bl) => { const at = Math.max(cur + 1, fin); return [...bl.slice(0, at), { slots: [o.slot], sets: 2, repMin: 8, repMax: 12, rest: 45 }, ...bl.slice(at)] })}>+</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="spacer" />
      <div className="bottom-c"><button className="btn primary" onClick={onDone}>Done</button></div>
    </Screen>
  )
}

/** The workout as it would be saved right now. */
function draftLog(a: ActiveWorkout, steps: Step[], rating: 'easy' | 'hard' | undefined, prior: WorkoutLog[]): WorkoutLog {
  const plan = activePlan(a)
  const end = Date.now()
  return {
    id: uid(), date: today(a.start), planId: plan.id, planName: plan.name, type: plan.type, equipment: a.equipment,
    start: a.start, end, sets: a.sets,
    minimum: plan.id === MINIMUM.id,
    complete: a.sets.length >= Math.min(steps.length, a.planned ?? steps.length) * 0.75,
    overruns: a.overruns ?? 0,
    extra: Math.max(0, a.sets.length - (a.planned ?? steps.length)),
    rating,
    stats: workoutStats(prior, a.sets),
  }
}

function saveWorkout(rating: 'easy' | 'hard' | undefined) {
  const s = getState()
  const a = s.active
  if (!a) return
  const steps = planSteps(activePlan(a), a.equipment)
  const log = draftLog(a, steps, rating, s.workouts)
  setState((st) => ({ ...st, active: null, workouts: [...st.workouts, log] }))
}

function DoneView({ active, steps, p, rating, setRating, allDone, onResume, onMore, onSave }: {
  active: ActiveWorkout; steps: Step[]; p: PhoenixState; rating: 'easy' | 'hard' | undefined; setRating: (r: 'easy' | 'hard' | undefined) => void
  allDone: boolean; onResume: () => void; onMore: () => void; onSave: () => void
}) {
  const history = useStore((s) => s.workouts)
  const bird = useRef<HTMLCanvasElement>(null)
  const [log] = useState(() => draftLog(active, steps, rating, history))
  const lg = { ...log, rating }
  const todays = history.filter((w) => w.date === log.date)
  const upkeep = workoutUpkeep(lg)
  const had = Math.max(0, ...todays.map(workoutUpkeep))
  const items = [...(upkeep > had ? [{ label: upkeep === 100 ? 'Finished' : '10-min minimum', xp: upkeep - had }] : []), ...workoutBonuses(lg)]
  const seq: [number, number][] = []
  items.reduce((acc, it, k) => {
    seq.push([1150 + k * 420, acc + it.xp])
    return acc + it.xp
  }, 0)
  const totalXp = items.reduce((a, i) => a + i.xp, 0)
  const mins = (log.end - log.start) / 60000
  const diff = GOAL_MIN * 60 - (log.end - log.start) / 1000
  const lastSame = [...history].reverse().find((w) => w.planId === log.planId)
  const vol = volume(log.sets)
  const lastVol = lastSame ? volume(lastSame.sets) : 0
  const prs = log.stats?.prs ?? 0
  const stats = [
    { l: 'Time', v: fmtClock(mins * 60), n: diff >= 0 ? `−${fmtClock(diff)}` : `+${fmtClock(-diff)}` },
    { l: 'Sets', v: `${log.sets.length}/${active.planned ?? steps.length}`, n: log.extra ? `+${log.extra}` : '' },
    { l: 'Volume', v: vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : String(vol), n: lastVol ? `${vol >= lastVol ? '+' : '−'}${Math.abs(Math.round(((vol - lastVol) / lastVol) * 100))}%` : '' },
    { l: 'PRs', v: String(prs), n: '' },
  ]
  return (
    <Screen scroll>
      <div className="head" style={{ alignItems: 'center', flex: 'none' }}>
        <span className="title">Done</span>
        {allDone ? (
          <button className="btn" aria-label="Go beyond the plan for 30 more XP" onClick={onMore}>+1 more set</button>
        ) : (
          <button className="btn" onClick={onResume}>Resume</button>
        )}
      </div>
      <div className="burst">
        <Led cfg={{ pitch: 7, bare: true, fills: false, orb: { at: bird, r: 0.4, k: 0.85, ref: FLAME_REF }, burst: { delay: 120, rings: [250, 600, 950], r0: 0.15, reach: 0.6 } }} />
        <Bird p={p} ref={bird} className="bird pop" />
      </div>
      <div style={{ display: 'grid', placeItems: 'center', flex: 'none' }}>
        <div className="led-box" style={{ width: 300, maxWidth: '100%', height: 52 }}>
          <Led cfg={{ fit: true, maxPitch: 7, bare: true, fills: false, text: { count: { seq: seq.length ? seq : [[0, 0]], dur: 380, pre: '+', post: ' XP' }, fitStr: `+${totalXp} XP`, S: 1 } }} label={`Plus ${totalXp} XP`} />
        </div>
      </div>
      <div className="stats4">
        {stats.map((s) => (
          <div className="stat" key={s.l}>
            <span className="s-l">{s.l}</span>
            <span className="s-v">{s.v}</span>
            <span className="s-n">{s.n}</span>
          </div>
        ))}
      </div>
      <div className="xprows">
        {items.map((it, k) => (
          <div className="xr land" key={k} style={{ animationDelay: `${1090 + k * 420}ms` }}>
            <span>{it.label}</span>
            <span>+{it.xp}</span>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <div className="rate" role="group" aria-label="How hard was it">
        <button className={rating === 'easy' ? 'on' : ''} aria-label="Easy" aria-pressed={rating === 'easy'} onClick={() => setRating('easy')}>❄️</button>
        <button className={!rating ? 'on' : ''} aria-label="Right" aria-pressed={!rating} onClick={() => setRating(undefined)}>🔥</button>
        <button className={rating === 'hard' ? 'on' : ''} aria-label="Hard" aria-pressed={rating === 'hard'} onClick={() => setRating('hard')}>😅</button>
      </div>
      <div className="bottom-c"><button className="btn primary" onClick={onSave}>{active.sets.length ? 'Save' : 'Discard'}</button></div>
    </Screen>
  )
}

/** Sets that beat last time, lifting PRs, and whether interval totals set a record. */
function workoutStats(prior: WorkoutLog[], sets: SetLog[]) {
  const kindOf = (id: string) => exerciseById(id)?.kind
  const unitOf2 = (id: string) => exerciseById(id)?.unit
  let beats = 0
  const seen = new Map<string, number>()
  for (const s of sets) {
    const i = seen.get(s.exerciseId) ?? 0
    seen.set(s.exerciseId, i + 1)
    const prev = lastSetsFor(prior, s.exerciseId)[i]
    if (!prev || kindOf(s.exerciseId) === 'cardio' || unitOf2(s.exerciseId) === 'level') continue
    if (e1rm(s.weight, s.reps) > e1rm(prev.weight, prev.reps)) beats++
  }
  const liftSets = sets.filter((s) => ['weighted', 'reps', 'hold'].includes(kindOf(s.exerciseId) ?? ''))
  const prs = newPRs(prior, liftSets).length
  let cardioPR = false
  const intervalIds = new Set(sets.filter((s) => kindOf(s.exerciseId) === 'interval' && unitOf2(s.exerciseId) !== 'level').map((s) => s.exerciseId))
  for (const id of intervalIds) {
    const total = sets.filter((s) => s.exerciseId === id).reduce((a, s) => a + s.reps, 0)
    const best = Math.max(0, ...prior.map((w) => w.sets.filter((s) => s.exerciseId === id).reduce((a, s) => a + s.reps, 0)))
    if (best > 0 && total > best) cardioPR = true
  }
  return { beats, prs, cardioPR }
}
