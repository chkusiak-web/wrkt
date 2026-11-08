import { useMemo, useState } from 'react'
import { setState, useStore } from '../lib/store'
import { addDays, today as todayKey, parseDay, fmtDay, uid } from '../lib/date'
import { currentWeight, foodStreak, targets } from '../lib/progress'
import { suggest } from '../lib/coach'
import { usePhoenix } from '../lib/usePhoenix'
import { LEVELS, UPKEEP, type PhoenixState } from '../lib/xp'
import { unlockAudio } from '../lib/fx'
import { Bar, Card, Seg, Stepper } from '../components/ui'
import Roost from '../components/Roost'
import type { Tab } from '../App'

export default function Today({ go }: { go: (t: Tab) => void }) {
  const state = useStore((s) => s)
  const { profile, workouts, foods, weights } = state
  const today = todayKey()
  const p = usePhoenix()
  const doneToday = workouts.some((w) => w.date === today)
  const fStreak = useMemo(() => foodStreak(state), [state])
  const weight = currentWeight(state)
  const t = profile ? targets(profile, weight) : null
  const eaten = foods.filter((f) => f.date === today)
  const kcal = eaten.reduce((a, f) => a + f.kcal, 0)
  const protein = eaten.reduce((a, f) => a + f.protein, 0)
  const next = useMemo(() => suggest(state).plan, [state])
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
      <PhoenixCard p={p} />
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
      ) : !doneToday ? (
        <Card className="highlight">
          <div className="tag">Today · feeds the phoenix 100 XP</div>
          <h2>{next.name}</h2>
          <p className="muted">{next.blurb}</p>
          <button className="primary big-btn" onClick={() => go('workout')}>Start workout</button>
          <button className="ghost" style={{ width: '100%', marginTop: 6 }} onClick={() => startMinimum(go)}>
            Short on time? 10-min minimum (40 XP)
          </button>
        </Card>
      ) : null}

      <ExtraCardio />

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

function startMinimum(go: (t: Tab) => void) {
  unlockAudio()
  setState((s) => ({
    ...s,
    active: { planId: 'minimum', equipment: s.profile?.equipment ?? 'gym', start: Date.now(), step: 0, sets: [], skipped: [] },
  }))
  go('workout')
}

function PhoenixCard({ p }: { p: PhoenixState }) {
  const lv = LEVELS[p.level]
  const fed = Math.min(UPKEEP, p.today.total)
  const isTop = p.level === LEVELS.length - 1
  const coverDays = Math.floor(p.bank / UPKEEP)
  return (
    <Card className="phoenix-card">
      <Roost p={p} />
      <div className="pc-body">
        <div className="card-head">
          <span className="lv-name">{p.started ? lv.name : 'Egg'}</span>
          <span className="muted small">Level {p.level + 1} of {LEVELS.length}</span>
        </div>
        {!p.started && <div className="alert">Your phoenix hatches when you finish your first workout.</div>}
        {p.ash && <div className="alert ash">Your phoenix burned to ash. Do at least a 10-min workout today to make it rise again.</div>}
        {p.safeThrough && <div className="alert">New level! Protected from burning until {fmtDay(p.safeThrough)}.</div>}
        <Bar label="Feed today" value={fed} max={UPKEEP} right={`${fed} / ${UPKEEP} XP`} />
        {!isTop && <Bar label="Bank → next level" value={p.bank} max={lv.next} color="var(--l3)" right={`${p.bank.toLocaleString()} / ${lv.next.toLocaleString()}`} />}
        {p.started && !p.ash && (
          <div className="muted small">
            {p.today.total > UPKEEP
              ? `+${p.today.total - UPKEEP} to the bank today.`
              : coverDays > 0
                ? `Bank covers ${coverDays} missed day${coverDays > 1 ? 's' : ''}.`
                : 'Bank is empty. Miss a day and it burns.'}
            {p.bigDay ? ' Big day ✨' : ''}
          </div>
        )}
        {p.today.items.length > 0 && (
          <ul className="xp-items">
            {p.today.items.map((i, k) => (
              <li key={k}><span>{i.label}</span><b>+{i.xp}</b></li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function ExtraCardio() {
  const cardio = useStore((s) => s.cardio)
  const today = todayKey()
  const [open, setOpen] = useState(false)
  const [mins, setMins] = useState(20)
  const [hard, setHard] = useState(false)
  const mine = (cardio ?? []).filter((c) => c.date === today)
  const log = () => {
    setState((s) => ({ ...s, cardio: [...(s.cardio ?? []), { id: uid(), date: today, minutes: mins, hard, ts: Date.now() }] }))
    setOpen(false)
  }
  return (
    <Card>
      <div className="card-head">
        <h2>Extra cardio</h2>
        {!open && <button className="small-btn" onClick={() => setOpen(true)}>+ Log</button>}
      </div>
      <div className="muted small">Walks, rides, runs past your plan. 5 XP/min easy, 8 XP/min hard.</div>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          <Stepper label="minutes" value={mins} onChange={setMins} step={5} />
          <Seg options={[{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard' }]} value={hard ? 'hard' : 'easy'} onChange={(v) => setHard(v === 'hard')} />
          <div className="row">
            <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary" disabled={!mins} onClick={log}>Log +{mins * (hard ? 8 : 5)} XP</button>
          </div>
        </div>
      )}
      {mine.map((c) => (
        <div className="food-row" key={c.id}>
          <span>{c.minutes} min {c.hard ? 'hard' : 'easy'}</span>
          <button className="ghost small-btn" aria-label="delete" onClick={() => setState((s) => ({ ...s, cardio: s.cardio.filter((x) => x.id !== c.id), deleted: [...(s.deleted ?? []), c.id] }))}>✕</button>
        </div>
      ))}
    </Card>
  )
}
