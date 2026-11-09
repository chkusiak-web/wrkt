import { useState } from 'react'
import { setState, useStore } from '../lib/store'
import { today } from '../lib/date'
import { currentWeight } from '../lib/progress'
import { useNav } from '../nav'
import { Back, Bar, HoldBtn, Screen } from '../components/kit'
import { Led } from '../led/Led'
import { weightRate } from './Stats'

export default function WeighIn() {
  const nav = useNav()
  const state = useStore((s) => s)
  const logged = state.weights.find((w) => w.date === today())
  const [w, setW] = useState(() => logged?.lbs ?? currentWeight(state))
  const [entry, setEntry] = useState<string | null>(null)
  const { trend, perWeek } = weightRate(state.weights)
  const nudge = (d: number) => setW((v) => Math.max(50, Math.min(700, Math.round((v + d) * 10) / 10)))
  const save = () => {
    setState((s) => ({ ...s, weights: [...s.weights.filter((x) => x.date !== today()), { date: today(), lbs: w }] }))
    nav.replace({ s: 'stats', tab: 'weight' })
  }
  const press = (k: string) =>
    setEntry((e0) => {
      let e = e0 ?? ''
      const dot = e.indexOf('.')
      if (k === 'del') e = e.slice(0, -1)
      else if (k === '.') {
        if (dot < 0) e = (e || '0') + '.'
      } else if (dot >= 0) {
        if (e.length - dot < 2) e += k
      } else if (e.length < 3) e = (e === '0' ? '' : e) + k
      return e
    })

  return (
    <Screen>
      <Bar left={<Back label="Home" onClick={nav.back} />} />
      <div className="title">Weight</div>
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span className="xs muted">lb</span>
        <div className="lstep-row">
          <HoldBtn label="Minus 0.1" onStep={() => nudge(-0.1)}>−</HoldBtn>
          <button className="led-box" style={{ width: 190, height: 84, border: 0, background: 'none', padding: 0 }} aria-label={`${w.toFixed(1)} pounds, tap to type`} onClick={() => setEntry('')}>
            <Led cfg={{ fit: true, maxPitch: 8, bare: true, text: { str: w.toFixed(1), fitStr: '888.8', S: 1 } }} />
          </button>
          <HoldBtn label="Plus 0.1" onStep={() => nudge(0.1)}>+</HoldBtn>
        </div>
        {logged && <span className="xs muted">Logged today. Saving replaces it.</span>}
      </div>
      {trend != null && (
        <div className="card" style={{ fontSize: 15, fontWeight: 600 }}>
          Trend {trend.toFixed(1)}{perWeek != null ? ` · ${perWeek <= 0 ? '−' : '+'}${Math.abs(perWeek).toFixed(1)} / wk` : ''}
        </div>
      )}
      <div className="bottom-c"><button className="btn primary" onClick={save}>Save</button></div>

      {entry != null && (
        <div className="pad-wrap" role="dialog" aria-label="Type your weight">
          <Bar left={<Back label="Cancel" onClick={() => setEntry(null)} />} />
          <div className="grow" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="led-box" style={{ width: 220, height: 90 }}>
              <Led cfg={{ fit: true, maxPitch: 8, bare: true, text: { str: entry || '0', fitStr: '888.8', S: 1 } }} label={`${entry || 0} pounds`} />
            </div>
          </div>
          <div className="keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
              <button key={k} aria-label={k === 'del' ? 'Delete' : k === '.' ? 'Point' : k} onClick={() => press(k)}>{k === 'del' ? '⌫' : k}</button>
            ))}
          </div>
          <div className="bottom-c">
            <button
              className="btn primary"
              onClick={() => {
                const n = parseFloat(entry)
                if (n >= 50 && n <= 700) setW(Math.round(n * 10) / 10)
                setEntry(null)
              }}
            >
              Use
            </button>
          </div>
        </div>
      )}
    </Screen>
  )
}
