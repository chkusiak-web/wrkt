import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useStore } from './lib/store'
import { initSync } from './lib/sync'
import { usePhoenix, useLevelTheme } from './lib/usePhoenix'
import { LEVELS, type PhoenixState } from './lib/xp'
import Roost from './components/Roost'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import Workout from './screens/Workout'
import Food from './screens/Food'
import Progress from './screens/Progress'
import Settings from './screens/Settings'

export type Tab = 'today' | 'workout' | 'food' | 'progress' | 'settings'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '🏠', label: 'Today' },
  { id: 'workout', icon: '🏋️', label: 'Workout' },
  { id: 'food', icon: '🍽️', label: 'Food' },
  { id: 'progress', icon: '📈', label: 'Progress' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

let started = false

export default function App() {
  const profile = useStore((s) => s.profile)
  const active = useStore((s) => s.active)
  const [tab, setTab] = useState<Tab>(active ? 'workout' : 'today')
  const [session, setSession] = useState<Session | null>(null)
  const phoenix = usePhoenix()
  useLevelTheme(phoenix.level)

  useEffect(() => {
    if (started) return
    started = true
    initSync(setSession)
  }, [])

  if (!profile) return <Onboarding session={session} />

  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today go={setTab} />}
        {tab === 'workout' && <Workout />}
        {tab === 'food' && <Food />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings session={session} />}
      </main>
      <LevelEvent p={phoenix} />
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const SEEN_KEY = 'wt:seenEvent'

/** One-time celebration (or condolence) when the level changes. */
function LevelEvent({ p }: { p: PhoenixState }) {
  const ev = p.lastEvent
  const key = ev ? `${ev.kind}:${ev.date}:${ev.level}` : ''
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? ''
    } catch {
      return ''
    }
  })
  if (!ev || seen === key) return null
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, key)
    } catch {
      /* ignore */
    }
    setSeen(key)
  }
  const lv = LEVELS[ev.level]
  return (
    <div className="overlay" onClick={close}>
      <div className="card">
        <Roost p={p} />
        {ev.kind === 'up' ? (
          <>
            <h1>Level up: {lv.name}!</h1>
            <p className="muted">Your phoenix transformed, and the app changed with it. You're protected from burning for 7 days.</p>
          </>
        ) : (
          <>
            <h1>Burned to ash</h1>
            <p className="muted">The bank ran dry{ev.from > ev.level ? ` and your phoenix dropped to ${lv.name}` : ''}. Do at least a 10-min workout to make it rise.</p>
          </>
        )}
        <button className="primary big-btn" onClick={close}>{ev.kind === 'up' ? "Let's go" : 'Rise'}</button>
      </div>
    </div>
  )
}
