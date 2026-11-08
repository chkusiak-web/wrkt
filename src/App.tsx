import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useStore } from './lib/store'
import { initSync } from './lib/sync'
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
