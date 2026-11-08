import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveWorkout, Equipment, ExerciseKind, SetLog, WorkoutLog } from '../types'
import { getState, setState, useStore } from '../lib/store'
import { MINIMUM, PLANS, suggestedPlanId, planById, planSteps, type Step } from '../lib/plans'
import { targetFor, newPRs, volume, lastSetsFor, e1rm } from '../lib/progress'
import { usePhoenix } from '../lib/usePhoenix'
import { UPKEEP, workoutBonuses, workoutUpkeep } from '../lib/xp'
import { today, fmtClock, uid } from '../lib/date'
import { beep, keepAwake, unlockAudio } from '../lib/fx'
import { useNow } from '../lib/useNow'
import { Card, Seg, Stepper } from '../components/ui'

const GOAL_MIN = 30

const EQUIP: { value: Equipment; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'dumbbells', label: 'Home (DBs)' },
  { value: 'bodyweight', label: 'No equipment' },
]

export default function Workout() {
  const active = useStore((s) => s.active)
  const [summary, setSummary] = useState<WorkoutLog | null>(null)
  if (summary) return <Summary log={summary} onClose={() => setSummary(null)} />
  if (active) return <Runner active={active} onFinish={setSummary} />
  return <Picker />
}

function Picker() {
  const workouts = useStore((s) => s.workouts)
  const profile = useStore((s) => s.profile)
  const [eq, setEq] = useState<Equipment>(profile?.equipment ?? 'gym')
  const suggested = suggestedPlanId(workouts)

  const start = (planId: string) => {
    unlockAudio()
    setState((s) => ({
      ...s,
      profile: s.profile ? { ...s.profile, equipment: eq } : s.profile,
      active: { planId, equipment: eq, start: Date.now(), step: 0, sets: [], skipped: [] },
    }))
  }

  return (
    <div className="screen">
      <h1>Workout</h1>
      <label>Where are you today?</label>
      <Seg options={EQUIP} value={eq} onChange={setEq} />
      <div className="stack">
        {[planById(suggested), ...PLANS.filter((p) => p.id !== suggested)].map((p) => (
          <Card key={p.id} className={p.id === suggested ? 'highlight' : ''}>
            {p.id === suggested && <div className="tag">Up next</div>}
            <h2>{p.name}</h2>
            <p className="muted">{p.blurb}</p>
            <ul className="mini-list">
              {p.blocks.map((b, i) => (
                <li key={i}>
                  {b.slots.map((sl) => planSteps({ ...p, blocks: [b] }, eq).find((st) => st.slot === sl)!.exercise.name).join(' + ')}
                  <span className="muted"> · {b.sets}{b.work ? ` × ${b.work}s` : b.repMax ? ` × ${b.repMin}-${b.repMax}` : ''}</span>
                </li>
              ))}
            </ul>
            <button className={p.id === suggested ? 'primary' : ''} onClick={() => start(p.id)}>Start</button>
          </Card>
        ))}
        <Card>
          <div className="tag">Short on time?</div>
          <h2>{MINIMUM.name}</h2>
          <p className="muted">{MINIMUM.blurb}</p>
          <button onClick={() => start(MINIMUM.id)}>Start</button>
        </Card>
      </div>
    </div>
  )
}

type Phase = { kind: 'ready' } | { kind: 'work'; endAt: number } | { kind: 'rest'; endAt: number; pending?: SetLog }

function Runner({ active, onFinish }: { active: ActiveWorkout; onFinish: (w: WorkoutLog) => void }) {
  const history = useStore((s) => s.workouts)
  const restScale = useStore((s) => s.profile?.restScale ?? 1)
  const plan = planById(active.planId)
  const steps = useMemo(() => planSteps(plan, active.equipment), [plan, active.equipment])
  const now = useNow()
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const idx = nextIndex(steps, active.step, active.skipped)
  const step: Step | undefined = steps[idx]
  const target = step ? targetFor(step.exercise, step.block, step.setNo, history) : null
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const beeped = useRef(-1)

  useEffect(() => {
    void keepAwake(true)
    return () => void keepAwake(false)
  }, [])

  // prefill inputs with the target when the step changes
  useEffect(() => {
    if (!target) return
    const prevSame = [...active.sets].reverse().find((s) => s.exerciseId === step!.exercise.id)
    setWeight(prevSame?.weight || target.weight)
    setReps(target.reps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const update = (fn: (a: ActiveWorkout) => ActiveWorkout) => setState((s) => (s.active ? { ...s, active: fn(s.active) } : s))

  const logSet = (set: SetLog, advanceTo = idx + 1) => update((a) => ({ ...a, sets: [...a.sets, set], step: advanceTo }))

  const isInterval = step?.exercise.kind === 'interval'

  // timer transitions
  useEffect(() => {
    if (phase.kind === 'ready') return
    const left = Math.ceil((phase.endAt - now) / 1000)
    if (left <= 3 && left > 0 && beeped.current !== left) {
      beeped.current = left
      beep(1, 660)
    }
    if (now < phase.endAt) return
    beeped.current = -1
    if (phase.kind === 'work') {
      beep(2, 990)
      const rest = Math.round(step!.block.rest * restScale)
      setPhase({ kind: 'rest', endAt: Date.now() + rest * 1000 })
      return
    }
    // rest finished
    beep(2, 990)
    if (isInterval && phase.pending === undefined) {
      // interval round: log output now, roll into the next round automatically
      const nextIdx = nextIndex(steps, idx + 1, active.skipped)
      logSet({ exerciseId: step!.exercise.id, weight: 0, reps, ts: Date.now() })
      const nxt = steps[nextIdx]
      if (nxt && nxt.exercise.kind === 'interval' && nxt.blockIndex === step!.blockIndex) {
        setPhase({ kind: 'work', endAt: Date.now() + (nxt.block.work ?? 30) * 1000 })
      } else setPhase({ kind: 'ready' })
      return
    }
    setPhase({ kind: 'ready' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  const finish = () => {
    const a = getState().active
    if (!a) return
    const prior = getState().workouts
    const kinds = new Map(steps.map((st) => [st.exercise.id, st.exercise] as const))
    const log: WorkoutLog = {
      id: uid(), date: today(a.start), planId: plan.id, planName: plan.name, type: plan.type, equipment: a.equipment,
      start: a.start, end: Date.now(), sets: a.sets,
      minimum: plan.id === MINIMUM.id,
      complete: a.sets.length >= steps.length * 0.75,
      overruns: a.overruns ?? 0,
      stats: workoutStats(prior, a.sets, (id) => kinds.get(id)?.kind, (id) => kinds.get(id)?.unit),
    }
    setState((s) => ({ ...s, active: null, workouts: [...s.workouts, log] }))
    onFinish(log)
  }

  // all steps done
  if (!step) {
    return (
      <div className="screen center">
        <h1>Done! 💪</h1>
        <button className="primary big-btn" onClick={finish}>Save workout</button>
      </div>
    )
  }

  const elapsed = (now - active.start) / 1000
  const doneCount = active.sets.length + active.skipped.length
  const pace = elapsed / 60 / GOAL_MIN
  const progress = doneCount / steps.length
  const nextStep = steps[nextIndex(steps, idx + 1, active.skipped)]
  const unit = step.exercise.unit ?? (step.exercise.kind === 'hold' ? 'sec' : 'reps')

  const doneSet = () => {
    unlockAudio()
    const set: SetLog = { exerciseId: step.exercise.id, weight: step.exercise.kind === 'weighted' ? weight : 0, reps, ts: Date.now() }
    logSet(set)
    const rest = Math.round(step.block.rest * restScale)
    if (nextStep && rest > 0) setPhase({ kind: 'rest', endAt: Date.now() + rest * 1000, pending: set })
  }

  const skip = () => {
    update((a) => ({ ...a, skipped: [...a.skipped, idx], step: idx + 1 }))
    setPhase({ kind: 'ready' })
  }

  const left = phase.kind === 'ready' ? 0 : Math.max(0, (phase.endAt - now) / 1000)

  return (
    <div className="screen runner">
      <div className="runner-top">
        <div>
          <div className={`clock ${pace > progress + 0.15 ? 'warn' : ''}`}>{fmtClock(elapsed)}</div>
          <div className="muted small">{plan.name} · goal {GOAL_MIN}:00</div>
        </div>
        <button className="ghost" onClick={() => (confirm('End workout now and save what you did?') ? finish() : null)}>End</button>
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: `${progress * 100}%` }} /></div>

      {phase.kind === 'work' && (
        <div className="timer-big work">
          <div className="phase-label">GO</div>
          <div className="countdown">{Math.ceil(left)}</div>
          <div className="ex-name">{step.exercise.name}</div>
          <div className="muted">Round {step.setNo}/{step.sets} · {step.exercise.cue}</div>
        </div>
      )}

      {phase.kind === 'rest' && (
        <div className="timer-big rest">
          <div className="phase-label">REST</div>
          <div className="countdown">{Math.ceil(left)}</div>
          {isInterval && phase.pending === undefined ? (
            <>
              <Stepper label={`${unit} this round`} value={reps} onChange={setReps} />
              {target?.last && <div className="muted">Last time: {target.last.reps} {unit}</div>}
            </>
          ) : (
            <div className="up-next">
              <div className="muted small">UP NEXT</div>
              <div className="ex-name">{step.exercise.name}</div>
              <div className="muted">Set {step.setNo}/{step.sets}{target?.last ? ` · last: ${fmtSet(target.last, step.exercise.kind === 'weighted', unit)}` : ''}</div>
            </div>
          )}
          <div className="row">
            <button
              onClick={() => {
                update((a) => ({ ...a, overruns: (a.overruns ?? 0) + 1 }))
                setPhase({ ...phase, endAt: phase.endAt + 15000 })
              }}
            >
              +15s
            </button>
            <button className="primary" onClick={() => setPhase({ ...phase, endAt: Date.now() })}>Skip rest</button>
          </div>
        </div>
      )}

      {phase.kind === 'ready' && (
        <div className="set-card">
          <div className="muted small">
            {step.block.slots.length > 1 ? 'SUPERSET · ' : ''}
            {isInterval ? `Round ${step.setNo} of ${step.sets}` : `Set ${step.setNo} of ${step.sets}`}
          </div>
          <div className="ex-name">{step.exercise.name}</div>
          <div className="muted">{step.exercise.cue}</div>

          {target && (
            <div className="target">
              <div>
                <div className="muted small">LAST TIME</div>
                <div>{target.last ? fmtSet(target.last, step.exercise.kind === 'weighted', unit) : '—'}</div>
              </div>
              <div>
                <div className="muted small">BEAT IT</div>
                <div className="accent">{isInterval ? `${target.reps || '?'} ${unit}` : fmtSet({ weight: target.weight, reps: target.reps } as SetLog, step.exercise.kind === 'weighted', unit)}</div>
              </div>
            </div>
          )}
          {target && <div className="muted small">{target.note}</div>}

          {isInterval ? (
            <button
              className="primary big-btn"
              onClick={() => {
                unlockAudio()
                setPhase({ kind: 'work', endAt: Date.now() + (step.block.work ?? 30) * 1000 })
              }}
            >
              Start {step.block.work}s round
            </button>
          ) : (
            <>
              <div className="row">
                {step.exercise.kind === 'weighted' && <Stepper label="lb" value={weight} onChange={setWeight} step={5} />}
                <Stepper label={unit} value={reps} onChange={setReps} step={step.exercise.kind === 'hold' ? 5 : 1} />
              </div>
              <button className="primary big-btn" onClick={doneSet}>Done ✓</button>
            </>
          )}
          <button className="ghost" onClick={skip}>Skip this {isInterval ? 'round' : 'set'}</button>
        </div>
      )}
    </div>
  )
}

/** Sets that beat last time, lifting PRs, and whether interval totals set a record. */
function workoutStats(prior: WorkoutLog[], sets: SetLog[], kindOf: (id: string) => ExerciseKind | undefined, unitOf: (id: string) => string | undefined) {
  let beats = 0
  const seen = new Map<string, number>()
  for (const s of sets) {
    const i = seen.get(s.exerciseId) ?? 0
    seen.set(s.exerciseId, i + 1)
    const prev = lastSetsFor(prior, s.exerciseId)[i]
    if (!prev || kindOf(s.exerciseId) === 'cardio' || unitOf(s.exerciseId) === 'level') continue
    if (e1rm(s.weight, s.reps) > e1rm(prev.weight, prev.reps)) beats++
  }
  const liftSets = sets.filter((s) => ['weighted', 'reps', 'hold'].includes(kindOf(s.exerciseId) ?? ''))
  const prs = newPRs(prior, liftSets).length
  let cardioPR = false
  const intervalIds = new Set(sets.filter((s) => kindOf(s.exerciseId) === 'interval' && unitOf(s.exerciseId) !== 'level').map((s) => s.exerciseId))
  for (const id of intervalIds) {
    const total = sets.filter((s) => s.exerciseId === id).reduce((a, s) => a + s.reps, 0)
    const best = Math.max(0, ...prior.map((w) => w.sets.filter((s) => s.exerciseId === id).reduce((a, s) => a + s.reps, 0)))
    if (best > 0 && total > best) cardioPR = true
  }
  return { beats, prs, cardioPR }
}

function nextIndex(steps: Step[], from: number, skipped: number[]) {
  let i = from
  while (i < steps.length && skipped.includes(i)) i++
  return i
}

function fmtSet(s: Pick<SetLog, 'weight' | 'reps'>, weighted: boolean, unit: string) {
  return weighted && s.weight ? `${s.weight} lb × ${s.reps}` : `${s.reps} ${unit}`
}

function Summary({ log: initial, onClose }: { log: WorkoutLog; onClose: () => void }) {
  const all = useStore((s) => s.workouts)
  const log = all.find((w) => w.id === initial.id) ?? initial
  const p = usePhoenix()
  const prior = all.filter((w) => w.id !== log.id && w.start < log.start)
  const prs = newPRs(prior, log.sets)
  const lastSame = [...prior].reverse().find((w) => w.planId === log.planId)
  const vol = volume(log.sets)
  const lastVol = lastSame ? volume(lastSame.sets) : 0
  const mins = (log.end - log.start) / 60000
  const names = new Map([...PLANS, MINIMUM].flatMap((pl) => (['gym', 'dumbbells', 'bodyweight'] as Equipment[]).flatMap((eq) => planSteps(pl, eq).map((s) => [s.exercise.id, s.exercise.name] as const))))
  const upkeep = workoutUpkeep(log)
  const items = [...(upkeep ? [{ label: upkeep === 100 ? 'Workout done' : '10-min minimum', xp: upkeep }] : []), ...workoutBonuses(log)]
  const earned = items.reduce((a, i) => a + i.xp, 0)
  const rate = (r: 'easy' | 'hard') => setState((s) => ({ ...s, workouts: s.workouts.map((w) => (w.id === log.id ? { ...w, rating: r } : w)) }))

  return (
    <div className="screen center">
      <div className="flame">+{earned} XP</div>
      <h1>{p.today.total >= UPKEEP ? 'Phoenix fed 🔥' : `Phoenix fed ${p.today.total}/${UPKEEP}`}</h1>
      {(log.type === 'conditioning' || log.type === 'easy') && (
        <Card>
          <h2>How hard was that?</h2>
          <Seg options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard (+30 XP)' }]} value={log.rating ?? ('' as 'easy')} onChange={rate} />
        </Card>
      )}
      <Card>
        <ul className="xp-items">
          {items.map((i, k) => (
            <li key={k}><span>{i.label}</span><b>+{i.xp}</b></li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="stat-row"><span>Time</span><b className={mins <= GOAL_MIN ? 'good' : ''}>{fmtClock(mins * 60)}</b></div>
        <div className="stat-row"><span>Sets</span><b>{log.sets.length}</b></div>
        {vol > 0 && (
          <div className="stat-row">
            <span>Volume</span>
            <b>
              {vol.toLocaleString()} lb{' '}
              {lastVol > 0 && <span className={vol >= lastVol ? 'good' : 'warn'}>({vol >= lastVol ? '+' : ''}{Math.round(((vol - lastVol) / lastVol) * 100)}%)</span>}
            </b>
          </div>
        )}
      </Card>
      {prs.length > 0 && (
        <Card className="highlight">
          <h2>🏆 New records</h2>
          {prs.map((pr) => (
            <div key={pr.exerciseId}>{names.get(pr.exerciseId) ?? pr.exerciseId}: {pr.weight ? `${pr.weight} lb × ${pr.reps}` : pr.reps}</div>
          ))}
        </Card>
      )}
      <button className="primary big-btn" onClick={onClose}>Nice</button>
    </div>
  )
}
