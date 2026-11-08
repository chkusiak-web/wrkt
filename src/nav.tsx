import { createContext, useContext } from 'react'
import type { Meal } from './types'
import type { FoodHit } from './lib/food'

export type Route =
  | { s: 'welcome' }
  | { s: 'home' }
  | { s: 'plan' }
  | { s: 'recovery' }
  | { s: 'bank' }
  | { s: 'draftSwap'; block: number; slot: string }
  | { s: 'workout' }
  | { s: 'food'; date: string }
  | { s: 'add'; date: string; meal: Meal }
  | { s: 'portion'; date: string; meal: Meal; hit: FoodHit; grams?: number }
  | { s: 'scan'; date: string; meal: Meal }
  | { s: 'weigh' }
  | { s: 'stats'; tab?: StatsTab }
  | { s: 'settings' }

export type StatsTab = 'weight' | 'strength' | 'streaks' | 'fitness'

export interface Nav {
  go: (r: Route) => void
  replace: (r: Route) => void
  back: () => void
  /** drop everything and land on this screen, with Welcome underneath */
  reset: (r: Route) => void
}

export const NavCtx = createContext<Nav>({ go: () => {}, replace: () => {}, back: () => {}, reset: () => {} })
export const useNav = () => useContext(NavCtx)
