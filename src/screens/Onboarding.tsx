import { useState } from 'react'
import type { Profile, Sex } from '../types'
import { setState } from '../lib/store'
import { today } from '../lib/date'
import { targets } from '../lib/progress'
import { Card, Seg } from '../components/ui'
import type { Session } from '@supabase/supabase-js'
import { Account } from './Settings'

export const ACTIVITY = [
  { value: 1.2, label: 'Desk job' },
  { value: 1.375, label: 'Light' },
  { value: 1.55, label: 'Active' },
]

export function ProfileForm({ initial, onSave, cta }: { initial?: Profile | null; onSave: (p: Profile) => void; cta: string }) {
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'male')
  const [age, setAge] = useState(String(initial?.age ?? ''))
  const [ft, setFt] = useState(String(initial ? Math.floor(initial.heightIn / 12) : ''))
  const [inch, setInch] = useState(String(initial ? initial.heightIn % 12 : ''))
  const [weight, setWeight] = useState(String(initial?.startWeight ?? ''))
  const [goal, setGoal] = useState(String(initial?.goalWeight ?? ''))
  const [activity, setActivity] = useState(initial?.activity ?? 1.2)
  const [months, setMonths] = useState(18)

  const w = Number(weight)
  const g = Number(goal)
  const weekly = initial && months === 18 ? initial.weeklyLossLb : w > g ? Math.min(1.5, Math.max(0.25, +((w - g) / (months * 4.33)).toFixed(2))) : 0.5
  const valid = Number(age) > 0 && Number(ft) > 0 && w > 0 && g > 0
  const profile: Profile = {
    sex, age: Number(age), heightIn: Number(ft) * 12 + Number(inch || 0), startWeight: w, goalWeight: g, activity,
    equipment: initial?.equipment ?? 'gym', weeklyLossLb: weekly, usdaKey: initial?.usdaKey ?? '', restScale: initial?.restScale ?? 1,
  }
  const t = valid ? targets(profile, w) : null

  return (
    <div className="stack">
      <Card>
        <label>Sex (for calorie math)</label>
        <Seg options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={sex} onChange={setSex} />
        <div className="frow">
          <div><label>Age</label><input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
          <div><label>Height ft</label><input inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} /></div>
          <div><label>in</label><input inputMode="numeric" value={inch} onChange={(e) => setInch(e.target.value)} /></div>
        </div>
        <div className="frow">
          <div><label>{initial ? 'Start weight' : 'Weight now'} (lb)</label><input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><label>Goal weight (lb)</label><input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
        </div>
        <label>Daily activity outside workouts</label>
        <Seg options={ACTIVITY} value={activity} onChange={setActivity} />
        <label>Reach goal in</label>
        <Seg options={[{ value: 12, label: '12 mo' }, { value: 18, label: '18 mo' }, { value: 24, label: '24 mo' }]} value={months} onChange={setMonths} />
      </Card>
      {t && (
        <Card>
          <div className="big">{t.kcal} kcal / day</div>
          <div>{t.protein} g protein / day</div>
          <p className="muted">
            About {weekly} lb/week. That's a {t.deficit} kcal/day deficit from your ~{t.tdee} kcal burn. Moderate on purpose, so you don't
            burn out and rebound. Targets update as your weight drops.
          </p>
        </Card>
      )}
      <div className="bottom-c"><button className="btn primary wide" disabled={!valid} onClick={() => onSave(profile)}>{cta}</button></div>
    </div>
  )
}

export default function Onboarding({ session }: { session: Session | null }) {
  return (
    <div className="scr scroll">
      <details className="card">
        <summary>Already set up on another device? Sign in</summary>
        <Account session={session} />
      </details>
      <div className="title">Your targets</div>
      <p className="muted">One minute. You can change this later.</p>
      <ProfileForm
        cta="Start"
        onSave={(p) =>
          setState((s) => ({ ...s, profile: p, weights: s.weights.length ? s.weights : [{ date: today(), lbs: p.startWeight }] }))
        }
      />
    </div>
  )
}
