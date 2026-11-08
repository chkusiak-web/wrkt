import { useEffect, useRef } from 'react'
import { Led } from '../led/Led'
import { motion, onFrame, type LedCfg } from '../led/engine'
import { useNav } from '../nav'
import { useStore } from '../lib/store'
import { today } from '../lib/date'
import { UPKEEP, type PhoenixState } from '../lib/xp'
import { guessMeal } from './FoodDay'

const FOOD: LedCfg = { pitch: 7, floor: 0.14, shape: 'ripple', cx: 0.4, fills: false }
const WORK: LedCfg = { pitch: 7, floor: 0.14, shape: 'chevron', fills: false }
const WT: LedCfg = { pitch: 7, floor: 0.14, fills: false, line: { vals: [0.86, 0.82, 0.84, 0.74, 0.7, 0.72, 0.6, 0.55, 0.58, 0.46, 0.4, 0.42, 0.3, 0.24], lo: 0.15, hi: 0.95, loop: 9 } }
const STATS: LedCfg = { pitch: 7, floor: 0.14, fills: false, bars: { vals: [0.22, 0.34, 0.3, 0.48, 0.6, 0.72, 0.9], x: 0.05, y: 0.14, w: 0.9, h: 0.72, rel: true, gap: 1, loop: 9 } }
const FLOOD: LedCfg = { pitch: 7, bare: true, flame: 1.15 }

export default function Home({ p }: { p: PhoenixState }) {
  const nav = useNav()
  const active = useStore((s) => s.active)
  const fade = useRef<HTMLDivElement>(null)
  const fed = Math.min(UPKEEP, p.today.total)

  // you arrive inside the flame from GO; it drains away and Home shows through
  useEffect(
    () =>
      onFrame(() => {
        if (fade.current) fade.current.style.opacity = String(Math.max(0, 1 - motion.fill * 1.8))
      }),
    [],
  )

  const panels = [
    { name: 'Food', btn: 'Log', label: 'Log food', cfg: FOOD, on: () => nav.go({ s: 'add', date: today(), meal: guessMeal() }) },
    { name: 'Workout', btn: active ? 'Resume' : 'Go', label: active ? 'Resume your workout' : 'Start a workout', cfg: WORK, on: () => nav.go(active ? { s: 'workout' } : { s: 'plan' }) },
    { name: 'Weight', btn: 'Track', label: 'Track your weight', cfg: WT, on: () => nav.go({ s: 'weigh' }) },
    { name: 'Stats', btn: 'View', label: 'View your stats', cfg: STATS, on: () => nav.go({ s: 'stats' }) },
  ]

  return (
    <div className="scr bare">
      <div ref={fade} className="fadewrap" style={{ opacity: motion.fill > 0 ? 0 : 1 }}>
        <div className="head" style={{ minHeight: 44, alignItems: 'center' }}>
          <span className="title">Today</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span role="img" aria-label={`${fed} of ${UPKEEP} XP today`} className="muted num" style={{ fontSize: 15 }}>{fed}/{UPKEEP}</span>
            <button className="link pad-l" aria-label="Settings" onClick={() => nav.go({ s: 'settings' })} style={{ fontSize: 18 }}>⚙︎</button>
          </span>
        </div>
        <div className="panels">
          {panels.map((x) => (
            <button key={x.name} className="panel" aria-label={x.label} onClick={x.on}>
              <Led cfg={x.cfg} />
              <span className="p-name">{x.name}</span>
              <span className="p-btn">{x.btn}</span>
            </button>
          ))}
        </div>
      </div>
      <Led cfg={FLOOD} className="flood" />
    </div>
  )
}
