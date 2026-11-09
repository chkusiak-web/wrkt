const NONE: never[] = []
import { useMemo, useState } from 'react'
import type { Equipment } from '../types'
import { setState, useStore } from '../lib/store'
import { addDays, daysBetween, fmtDay, parseDay, today as todayKey, uid } from '../lib/date'
import { bestStreak, foodStreak, personalRecords, streak, weightTrend } from '../lib/progress'
import { MINIMUM, PLANS, planSteps } from '../lib/plans'
import { usePhoenix } from '../lib/usePhoenix'
import { LEVELS } from '../lib/xp'
import { useNav, type StatsTab } from '../nav'
import { Back, Bar, Chips, HoldBtn, Label, Screen } from '../components/kit'
import { Led, LedNum } from '../led/Led'

const names = new Map(
  [...PLANS, MINIMUM].flatMap((p) => (['gym', 'dumbbells', 'bodyweight'] as Equipment[]).flatMap((eq) => planSteps(p, eq).map((s) => [s.exercise.id, s.exercise.name] as const))),
)

/** Latest 7-day average, and the change per week over the last ~4 weeks (negative = losing). */
export function weightRate(weights: { date: string; lbs: number }[]) {
  const trend = weightTrend(weights)
  if (!trend.length) return { trend: null, perWeek: null, series: trend }
  const last = trend[trend.length - 1]
  const first = trend.find((t) => t.date >= addDays(last.date, -28)) ?? trend[0]
  const days = daysBetween(first.date, last.date)
  return { trend: last.avg, perWeek: days >= 7 ? ((last.avg - first.avg) / days) * 7 : null, series: trend }
}

const fmtSigned = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${Math.abs(n).toFixed(1)}`

export default function Stats({ tab: t0 }: { tab?: StatsTab }) {
  const nav = useNav()
  const [tab, setTab] = useState<StatsTab>(t0 ?? 'weight')
  return (
    <Screen scroll>
      <Bar left={<Back label="Home" onClick={() => nav.reset({ s: 'home' })} />} right={<button className="btn sm" onClick={() => nav.go({ s: 'weigh' })}>+ Weight</button>} />
      <div role="tablist" className="chips stretch">
        {(['weight', 'strength', 'streaks', 'fitness'] as StatsTab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'weight' && <WeightTab />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'streaks' && <StreaksTab />}
      {tab === 'fitness' && <FitnessTab />}
    </Screen>
  )
}

type Range = 30 | 90 | 365 | 0

function WeightTab() {
  const state = useStore((s) => s)
  const { profile, foods } = state
  const [range, setRange] = useState<Range>(90)
  const { trend, perWeek, series } = useMemo(() => weightRate(state.weights), [state.weights])
  const cur = trend ?? profile?.startWeight ?? 0
  const lost = profile ? cur - profile.startWeight : 0
  const toGo = profile ? cur - profile.goalWeight : 0
  const from = range ? addDays(todayKey(), -range) : ''
  const shown = series.filter((p) => p.date >= from)
  const vals = shown.map((p) => p.avg)
  const lo = Math.min(...vals) - 0.8
  const hi = Math.max(...vals) + 0.8
  const weekAgo = addDays(todayKey(), -7)
  const logged = new Set(foods.filter((f) => f.date >= weekAgo && f.date < todayKey()).map((f) => f.date))
  const avgKcal = logged.size ? Math.round(foods.filter((f) => logged.has(f.date)).reduce((a, f) => a + f.kcal, 0) / logged.size) : 0
  const goalBy = perWeek != null && perWeek < 0 && toGo > 0 ? new Date(Date.now() + (toGo / -perWeek) * 7 * 86400000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'
  const lostStr = (lost <= 0 ? '-' : '+') + Math.abs(lost).toFixed(1)
  return (
    <>
      <div className="head" style={{ alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <LedNum value={lostStr} fitStr={lostStr} w={Math.max(70, lostStr.length * 24)} h={36} maxPitch={7} label={`${fmtSigned(lost)} pounds`} />
          <span className="xs muted">lb</span>
        </span>
        <span className="small muted">{toGo > 0 ? `${toGo.toFixed(1)} to go` : 'Goal reached'}</span>
      </div>
      {vals.length >= 2 ? (
        <div className="led-box" style={{ height: 200 }}>
          <Led cfg={{ pitch: 6, bare: true, line: { vals, lo, hi } }} label={`Weight trend from ${vals[0].toFixed(1)} to ${vals[vals.length - 1].toFixed(1)}`} />
        </div>
      ) : (
        <div className="card note" style={{ height: 200, display: 'grid', placeItems: 'center' }}>Weigh in a few mornings to see your trend.</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Chips small value={range} onChange={setRange} options={[{ value: 30 as Range, label: '1M' }, { value: 90 as Range, label: '3M' }, { value: 365 as Range, label: '1Y' }, { value: 0 as Range, label: 'All' }]} />
      </div>
      <div className="rows">
        <div className="kv"><span>Trend</span><span>{trend != null ? trend.toFixed(1) : '—'}</span></div>
        <div className="kv"><span>Per week</span><span>{perWeek != null ? fmtSigned(perWeek) : '—'}</span></div>
        <div className="kv"><span>Avg kcal</span><span>{avgKcal ? avgKcal.toLocaleString() : '—'}</span></div>
        <div className="kv"><span>Goal by</span><span>{goalBy}</span></div>
      </div>
    </>
  )
}

function StrengthTab() {
  const workouts = useStore((s) => s.workouts)
  const prs = useMemo(() => Object.values(personalRecords(workouts)).filter((p) => names.has(p.exerciseId)).sort((a, b) => b.date.localeCompare(a.date)), [workouts])
  return (
    <>
      <Label>Records</Label>
      <div className="rows">
        {prs.map((p) => (
          <div className="kv" key={p.exerciseId}>
            <span>{names.get(p.exerciseId)}</span>
            <span>{p.weight ? `${p.weight} × ${p.reps}` : p.reps}</span>
          </div>
        ))}
        {!prs.length && <p className="note">Finish a workout to set your first records.</p>}
      </div>
      <Label>History</Label>
      <div className="rows">
        {[...workouts].reverse().slice(0, 40).map((w) => (
          <div className="row" key={w.id}>
            <span className="two">
              <span className="name" style={{ fontSize: 15 }}>{w.planName}</span>
              <span className="sub">{fmtDay(w.date)} · {Math.round((w.end - w.start) / 60000)} min · {w.sets.length} sets</span>
            </span>
            <button
              className="link"
              style={{ padding: '0 6px', fontSize: 16 }}
              aria-label={`Delete ${w.planName}`}
              onClick={() => confirm('Delete this workout?') && setState((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== w.id), deleted: [...(s.deleted ?? []), w.id] }))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function StreaksTab() {
  const state = useStore((s) => s)
  const ph = usePhoenix()
  const today = todayKey()
  const s = streak(state.workouts)
  const days = new Set(state.workouts.map((w) => w.date))
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const weekCount = week.filter((d) => days.has(d)).length
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8 }}>
        <LedNum value={String(s.count)} fitStr="888" w={150} h={64} label={`${s.count} day streak`} />
        <span className="small muted">day streak</span>
      </div>
      <div className="week">
        {week.map((d) => (
          <div key={d} className={`d ${days.has(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}>{parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</div>
        ))}
      </div>
      <div className="rows">
        <div className="kv"><span>This week</span><span>{weekCount} / 7</span></div>
        <div className="kv"><span>Best streak</span><span>{bestStreak(state.workouts)}</span></div>
        <div className="kv"><span>Food logging</span><span>{foodStreak(state)} day{foodStreak(state) === 1 ? "" : "s"}</span></div>
        <div className="kv"><span>Phoenix</span><span>{ph.started ? LEVELS[ph.level].name : 'Egg'}</span></div>
        <div className="kv"><span>Bank</span><span>{ph.bank.toLocaleString()}{ph.level < LEVELS.length - 1 ? ` / ${LEVELS[ph.level].next.toLocaleString()}` : ''}</span></div>
        <div className="kv"><span>Lifetime XP</span><span>{ph.lifetime.toLocaleString()}</span></div>
      </div>
      <ExtraCardio />
    </>
  )
}

function ExtraCardio() {
  const cardio = useStore((s) => s.cardio) ?? NONE
  const today = todayKey()
  const [mins, setMins] = useState(20)
  const [hard, setHard] = useState(false)
  const mine = cardio.filter((c) => c.date === today)
  const log = () => setState((s) => ({ ...s, cardio: [...(s.cardio ?? []), { id: uid(), date: today, minutes: mins, hard, ts: Date.now() }] }))
  return (
    <>
      <Label>Extra cardio</Label>
      <div className="card stack">
        <div className="head" style={{ alignItems: 'center' }}>
          <span className="mini-step">
            <HoldBtn className="round sm" label="Fewer minutes" onStep={() => setMins((m) => Math.max(5, m - 5))}>−</HoldBtn>
            <b>{mins}</b>
            <HoldBtn className="round sm" label="More minutes" onStep={() => setMins((m) => Math.min(240, m + 5))}>+</HoldBtn>
            <span>min</span>
          </span>
          <Chips small value={hard ? 'hard' : 'easy'} onChange={(v) => setHard(v === 'hard')} options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard' }]} />
        </div>
        <button className="btn primary wide" style={{ alignSelf: 'center' }} onClick={log}>Log +{mins * (hard ? 8 : 5)} XP</button>
        {mine.map((c) => (
          <div className="kv" key={c.id}>
            <span>{c.minutes} min {c.hard ? 'hard' : 'easy'} today</span>
            <button className="link" style={{ fontSize: 16 }} aria-label="Delete" onClick={() => setState((s) => ({ ...s, cardio: s.cardio.filter((x) => x.id !== c.id), deleted: [...(s.deleted ?? []), c.id] }))}>×</button>
          </div>
        ))}
      </div>
      <p className="note" style={{ textAlign: 'left' }}>Walks, rides, runs past your plan. 5 XP a minute easy, 8 hard.</p>
    </>
  )
}

function FitnessTab() {
  const checks = useStore((s) => s.checks) ?? NONE
  const [hr, setHr] = useState('')
  const [mile, setMile] = useState('')
  const sorted = [...checks].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted.at(-1)
  const today = todayKey()
  const due = !last || daysBetween(last.date, today) >= 28
  const fmtMile = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—')
  const parseMile = (v: string) => {
    const [m, sec] = v.split(':').map(Number)
    return v.includes(':') ? m * 60 + (sec || 0) : Math.round(Number(v) * 60)
  }
  const save = () => {
    const restingHr = Number(hr) || undefined
    const mileSec = mile ? parseMile(mile) || undefined : undefined
    if (!restingHr && !mileSec) return
    setState((s) => ({ ...s, checks: [...(s.checks ?? []), { id: uid(), date: today, restingHr, mileSec, ts: Date.now() }] }))
    setHr('')
    setMile('')
  }
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>Every 4 weeks: resting heart rate (60 sec count right after waking) and a timed mile. Beat your last check for +200 XP.</p>
      {due ? (
        <div className="stack">
          <div className="frow">
            <input inputMode="numeric" placeholder="Resting HR" value={hr} onChange={(e) => setHr(e.target.value)} aria-label="Resting heart rate" />
            <input inputMode="decimal" placeholder="Mile mm:ss" value={mile} onChange={(e) => setMile(e.target.value)} aria-label="Mile time" />
          </div>
          <div className="bottom-c"><button className="btn primary" onClick={save}>Save</button></div>
        </div>
      ) : (
        last && <p className="note">Next check {fmtDay(addDays(last.date, 28))}.</p>
      )}
      <div className="rows">
        {[...sorted].reverse().map((c) => (
          <div className="kv" key={c.id}>
            <span>{fmtDay(c.date)}</span>
            <span>{c.restingHr ?? '—'} bpm · {fmtMile(c.mileSec)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
