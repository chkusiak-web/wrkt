import { useEffect, useMemo } from 'react'
import { useStore } from './store'
import { computePhoenix, LEVELS } from './xp'
import { setRamp } from '../led/engine'

export function usePhoenix() {
  const state = useStore((s) => s)
  return useMemo(() => computePhoenix(state), [state])
}

/** Re-skin the whole app in the phoenix's level colors. */
export function useLevelTheme(level: number) {
  useEffect(() => {
    const [deep, low, mid, high, core] = LEVELS[level].light
    const s = document.documentElement.style
    s.setProperty('--l0', deep)
    s.setProperty('--l1', low)
    s.setProperty('--l2', mid)
    s.setProperty('--l3', high)
    s.setProperty('--l4', core)
    setRamp(LEVELS[level].light)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0A090B')
  }, [level])
}
