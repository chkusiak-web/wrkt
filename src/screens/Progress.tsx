import { useMemo } from 'react'
import type { Equipment } from '../types'
import { setState, useStore } from '../lib/store'
import { addDays, dayKey, fmtDay, parseDay } from '../lib/date'
import { bestStreak, personalRecords, streak, weightTrend } from '../lib/progress'
import { PLANS, planSteps } from '../lib/plans'
import { Card } from '../components/ui'

const names = new Map(
  PLANS.flatMap((p) => (['gym', 'dumbbells', 'bodyweight'] as Equipment[]).flatMap((eq) => planSteps(p, eq).map((s) => [s.exercise.id, s.exercise.name] as const))),
)

export default function Progress() {
  const state = useStore((s) => s)
  const { workouts, weights, foods, profile } = state
  const trend = useMemo(() => weightTrend(weights), [weights])
  const prs = useMemo(() => Object.values(personalRecords(workouts)).sort((a, b) => b.date.localeCompare(a.date)), [workouts])
  const st = streak(workouts)
  const best = bestStreak(workouts)
  const today = dayKey()
  const weekAgo = addDays(today, -6)
  const weekWorkouts = workouts.filter((w) => w.date >= weekAgo).length
  const weekMinutes = Math.round(workouts.filter((w) => w.date >= weekAgo).reduce((a, w) => a + (w.end - w.start) / 60000, 0))
  const loggedDays = new Set(foods.filter((f) => f.date >= weekAgo && f.date < today).map((f) => f.date))
  const avgKcal = loggedDays.size ? Math.round(foods.filter((f) => loggedDays.has(f.date)).reduce((a, f) => a + f.kcal, 0) / loggedDays.size) : 0

  // rate over the last ~4 weeks of the 7-day average
  let rate = 0
  if (trend.length >= 2) {
    const last = trend[trend.length - 1]
    const from = addDays(last.date, -28)
    const first = trend.find((t) => t.date >= from) ?? trend[0]
    const days = (parseDay(last.date).getTime() - parseDay(first.date).getTime()) / 86400000
    if (days >= 7) rate = ((first.avg - last.avg) / days) * 7
  }
  const cur = trend.length ? trend[trend.length - 1].avg : profile?.startWeight ?? 0
  const weeksLeft = profile && rate > 0 ? (cur - profile.goalWeight) / rate : 0

  return (
    <div className="screen">
      <h1>Progress</h1>
      <Card>
        <h2>Weight (7-day average)</h2>
        <WeightChart data={trend} goal={profile?.goalWeight} />
        <div className="muted small">
          {rate > 0
            ? `Losing ${rate.toFixed(1)} lb/week. At this pace you hit goal around ${new Date(Date.now() + weeksLeft * 7 * 86400000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}.`
            : 'Log your weight most mornings. The trend line smooths out water-weight swings.'}
        </div>
      </Card>

      <Card>
        <h2>Last 7 days</h2>
        <div className="stat-row"><span>Workouts</span><b>{weekWorkouts} / 7</b></div>
        <div className="stat-row"><span>Training time</span><b>{weekMinutes} min</b></div>
        <div className="stat-row"><span>Avg calories (logged days)</span><b>{avgKcal || '—'}</b></div>
        <div className="stat-row"><span>Streak · best</span><b>🔥 {st.count} · {best}</b></div>
      </Card>

      {prs.length > 0 && (
        <Card>
          <h2>Personal records</h2>
          {prs.map((p) => (
            <div className="stat-row" key={p.exerciseId}>
              <span>{names.get(p.exerciseId) ?? p.exerciseId}</span>
              <b>{p.weight ? `${p.weight} × ${p.reps}` : p.reps}</b>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <h2>History</h2>
        {workouts.length === 0 && <div className="muted">No workouts yet.</div>}
        {[...workouts].reverse().slice(0, 30).map((w) => (
          <div className="food-row" key={w.id}>
            <div>
              <div>{w.planName}</div>
              <div className="muted small">{fmtDay(w.date)} · {Math.round((w.end - w.start) / 60000)} min · {w.sets.length} sets</div>
            </div>
            <button
              className="ghost small-btn"
              aria-label="delete"
              onClick={() => confirm('Delete this workout?') && setState((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== w.id), deleted: [...(s.deleted ?? []), w.id] }))}
            >
              ✕
            </button>
          </div>
        ))}
      </Card>
    </div>
  )
}

function WeightChart({ data, goal }: { data: { date: string; lbs: number; avg: number }[]; goal?: number }) {
  if (data.length < 2) return <div className="muted">Need at least 2 weigh-ins for a chart.</div>
  const W = 340
  const H = 160
  const pad = 28
  const t0 = parseDay(data[0].date).getTime()
  const t1 = parseDay(data[data.length - 1].date).getTime()
  const vals = data.flatMap((d) => [d.lbs, d.avg])
  if (goal && goal > Math.min(...vals) - 20) vals.push(goal)
  const lo = Math.floor(Math.min(...vals) - 2)
  const hi = Math.ceil(Math.max(...vals) + 2)
  const x = (d: string) => pad + ((parseDay(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad - 8)
  const y = (v: number) => 8 + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 24)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.avg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Weight trend">
      {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - 8} y1={y(v)} y2={y(v)} className="grid" />
          <text x={2} y={y(v) + 4} className="axis">{v}</text>
        </g>
      ))}
      {goal && goal >= lo && <line x1={pad} x2={W - 8} y1={y(goal)} y2={y(goal)} className="goal" />}
      {data.map((d) => <circle key={d.date} cx={x(d.date)} cy={y(d.lbs)} r={2.5} className="dot" />)}
      <path d={path} className="line" />
      <text x={pad} y={H - 2} className="axis">{fmtDay(data[0].date)}</text>
      <text x={W - 8} y={H - 2} className="axis" textAnchor="end">{fmtDay(data[data.length - 1].date)}</text>
    </svg>
  )
}
