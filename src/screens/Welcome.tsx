import { useEffect, useRef } from 'react'
import { Led } from '../led/Led'
import { FLAME_REF, flameTransition, motion, onFrame } from '../led/engine'
import Bird from '../components/Bird'
import { useNav } from '../nav'
import { UPKEEP, type PhoenixState } from '../lib/xp'
import { unlockAudio } from '../lib/fx'

/** The front door: the phoenix in its fire, today's XP, and GO. */
export default function Welcome({ p }: { p: PhoenixState }) {
  const nav = useNav()
  const bird = useRef<HTMLCanvasElement>(null)
  const xpbar = useRef<HTMLDivElement>(null)
  const goA = useRef<HTMLButtonElement>(null)
  const fed = Math.min(UPKEEP, p.today.total)

  // the bird is swallowed as the flame rises
  useEffect(
    () =>
      onFrame(() => {
        if (bird.current) bird.current.style.opacity = String(Math.max(0, Math.min(1, (0.55 - motion.fill * 1.25) / 0.25)))
      }),
    [],
  )

  const go = () => {
    unlockAudio()
    flameTransition(() => nav.go({ s: 'home' }))
  }

  return (
    <div className="scr welcome">
      <Led cfg={{ pitch: 7, orb: { at: bird, r: 0.31, k: p.ash ? 0.25 : 0.8, ref: FLAME_REF }, flame: 0.88, text: { str: 'GO', at: goA, S: 2 }, mbar: { at: xpbar, frac: fed / UPKEEP } }} />
      <Bird p={p} ref={bird} className="bird" />
      <div className="xp">
        <div className="xp-top">
          <span />
          <span className="num">{fed}/{UPKEEP}</span>
        </div>
        <div ref={xpbar} role="img" aria-label={`${fed} of ${UPKEEP} XP today`} style={{ height: 10 }} />
      </div>
      <button ref={goA} className="go" aria-label="Go" onClick={go} />
    </div>
  )
}
