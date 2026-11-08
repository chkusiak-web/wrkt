import { useMemo, useState } from 'react'
import { setState, useStore } from '../lib/store'
import { addDays, dayKey, parseDay } from '../lib/date'
import { bestStreak, currentWeight, foodStreak, streak, targets } from '../lib/progress'
import { nextPlanId, planById } from '../lib/plans'
import { Bar, Card } from '../components/ui'
import type { Tab } from '../App'

export default function Today({ go }: { go: (t: Tab) => void }) {
  const state = useStore((s) => s)
  const { profile, workouts, foods, weights } = state
  const today = dayKey()
  const st = useMemo(() => streak(workouts), [workouts])
  const best = useMemo(() => bestStreak(workouts), [workouts])
  const fStreak = useMemo(() => foodStreak(state), [state])
  const weight = currentWeight(state)
  const t = profile ? targets(profile, weight) : null
  const eaten = foods.filter((f) => f.date === today)
  const kcal = eaten.reduce((a, f) => a + f.kcal, 0)
  const protein = eaten.reduce((a, f) => a + f.protein, 0)
  const next = planById(nextPlanId(workouts[workouts.length - 1]?.planId))
  const todayWeight = weights.find((w) => w.date === today)
  const [wInput, setWInput] = useState('')
  const lost = profile ? profile.startWeight - weight : 0
  const toGo = profile ? weight - profile.goalWeight : 0

  const days = new Set(workouts.map((w) => w.date))
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  const saveWeight = () => {
    const lbs = Number(wInput)
    if (!lbs) return
    setState((s) => ({ ...s, weights: [...s.weights.filter((w) => w.date !== today), { date: today, lbs }] }))
    setWInput('')
  }

  return (
    <div className="screen">
      <div className="streak-hero">
        <div className={`flame ${st.doneToday ? '' : 'dim'}`}>🔥 {st.count}</div>
        <div>
          <div className="big">{st.count} day streak</div>
          <div className="muted small">{st.doneToday ? 'Done today. Nice.' : st.count ? "Don't break it. Even an easy day counts." : 'Start your streak today.'} Best: {best}</div>
        </div>
      </div>
      <div className="week">
        {week.map((d) => (
          <div key={d} className={`day ${days.has(d) ? 'on' : ''} ${d === today ? 'today' : ''}`}>
            <span>{parseDay(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
          </div>
        ))}
      </div>

      {state.active ? (
        <Card className="highlight">
          <h2>Workout in progress</h2>
          <button className="primary big-btn" onClick={() => go('workout')}>Resume</button>
        </Card>
      ) : !st.doneToday ? (
        <Card className="highlight">
          <div className="tag">Today</div>
          <h2>{next.name}</h2>
          <p className="muted">{next.blurb}</p>
          <button className="primary big-btn" onClick={() => go('workout')}>Start workout</button>
        </Card>
      ) : null}

      {t && (
        <Card>
          <div className="card-head">
            <h2>Food today</h2>
            <button className="small-btn" onClick={() => go('food')}>+ Log</button>
          </div>
          <Bar label="Calories" value={kcal} max={t.kcal} right={`${Math.round(kcal)} / ${t.kcal}`} />
          <Bar label="Protein" value={protein} max={t.protein} color="var(--accent2)" right={`${Math.round(protein)} / ${t.protein} g`} />
          <div className="muted small">
            {kcal <= t.kcal ? `${Math.round(t.kcal - kcal)} kcal left` : `${Math.round(kcal - t.kcal)} over. It's fine. One day doesn't matter, the week does.`}
            {fStreak > 1 && ` · 📒 ${fStreak}-day logging streak`}
          </div>
        </Card>
      )}

      <Card>
        <h2>Weight</h2>
        {todayWeight ? (
          <div>Logged {todayWeight.lbs} lb today.</div>
        ) : (
          <div className="row">
            <input inputMode="decimal" placeholder="lb (morning, after bathroom)" value={wInput} onChange={(e) => setWInput(e.target.value)} />
            <button className="primary" onClick={saveWeight}>Save</button>
          </div>
        )}
        {profile && (
          <div className="muted small">
            {lost > 0 ? `Down ${lost.toFixed(1)} lb · ` : ''}
            {toGo > 0 ? `${toGo.toFixed(1)} lb to goal` : 'Goal reached! 🎉'}
          </div>
        )}
      </Card>
    </div>
  )
}
