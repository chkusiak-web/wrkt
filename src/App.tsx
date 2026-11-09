import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useStore } from './lib/store'
import { initSync } from './lib/sync'
import { usePhoenix, useLevelTheme } from './lib/usePhoenix'
import { LEVELS, type PhoenixState } from './lib/xp'
import { NavCtx, type Nav, type Route } from './nav'
import Roost from './components/Roost'
import Onboarding from './screens/Onboarding'
import Welcome from './screens/Welcome'
import Home from './screens/Home'
import { Bank, DraftSwap, PlanScreen, RecoveryScreen } from './screens/Plan'
import Runner from './screens/Runner'
import FoodDay from './screens/FoodDay'
import { AddFood, Portion, ScanScreen } from './screens/AddFood'
import WeighIn from './screens/WeighIn'
import Stats from './screens/Stats'
import Settings from './screens/Settings'

let started = false

export default function App() {
  const profile = useStore((s) => s.profile)
  const [session, setSession] = useState<Session | null>(null)
  const [stack, setStack] = useState<Route[]>([{ s: 'welcome' }])
  const depth = useRef(1)
  depth.current = stack.length
  const phoenix = usePhoenix()
  useLevelTheme(phoenix.level)

  useEffect(() => {
    if (started) return
    started = true
    initSync(setSession)
  }, [])

  // the phone's back gesture walks back through screens
  useEffect(() => {
    const onPop = () => {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const nav: Nav = useMemo(
    () => ({
      go: (r) => {
        history.pushState({ d: depth.current + 1 }, '')
        setStack((s) => [...s, r])
      },
      replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
      back: () => {
        if (depth.current > 1) history.back()
      },
      reset: (r) => {
        history.pushState({ d: 2 }, '')
        setStack([{ s: 'welcome' }, ...(r.s === 'home' || r.s === 'welcome' ? [] : [{ s: 'home' } as Route]), ...(r.s === 'welcome' ? [] : [r])])
      },
    }),
    [],
  )

  // a fresh screen starts at the top
  const top = stack[stack.length - 1]
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [top])

  if (!profile) return <Onboarding session={session} />

  return (
    <NavCtx.Provider value={nav}>
      <Screen r={top} session={session} p={phoenix} key={stack.length + top.s} />
      <LevelEvent p={phoenix} />
    </NavCtx.Provider>
  )
}

function Screen({ r, session, p }: { r: Route; session: Session | null; p: PhoenixState }) {
  switch (r.s) {
    case 'welcome': return <Welcome p={p} />
    case 'home': return <Home p={p} />
    case 'plan': return <PlanScreen />
    case 'recovery': return <RecoveryScreen />
    case 'bank': return <Bank />
    case 'draftSwap': return <DraftSwap block={r.block} slot={r.slot} />
    case 'workout': return <Runner p={p} />
    case 'food': return <FoodDay date={r.date} />
    case 'add': return <AddFood date={r.date} meal={r.meal} />
    case 'portion': return <Portion date={r.date} meal={r.meal} hit={r.hit} grams={r.grams} />
    case 'scan': return <ScanScreen date={r.date} meal={r.meal} />
    case 'weigh': return <WeighIn />
    case 'stats': return <Stats tab={r.tab} />
    case 'settings': return <Settings session={session} />
  }
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
            <div className="title md">{lv.name}</div>
            <p className="muted small">Your phoenix leveled up and the app changed with it. Safe from burning for 7 days.</p>
          </>
        ) : (
          <>
            <div className="title md">Burned to ash</div>
            <p className="muted small">The bank ran dry{ev.from > ev.level ? ` and your phoenix dropped to ${lv.name}` : ''}. A 10-min workout makes it rise.</p>
          </>
        )}
        <button className="btn primary" onClick={close}>{ev.kind === 'up' ? "Let's go" : 'Rise'}</button>
      </div>
    </div>
  )
}
