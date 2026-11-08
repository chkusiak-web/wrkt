import { useSyncExternalStore } from 'react'
import type { AppState } from '../types'

const KEY = 'wt:v1'
const empty: AppState = { version: 1, profile: null, workouts: [], foods: [], weights: [], active: null }

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return empty
}

let state: AppState = load()
const listeners = new Set<() => void>()

export function getState() {
  return state
}

type Hook = (s: AppState) => void
let onChange: Hook | null = null
export function onLocalChange(h: Hook) {
  onChange = h
}

export function setState(fn: (s: AppState) => AppState, fromSync = false) {
  const prev = state
  state = fn(state)
  if (!fromSync) {
    state = { ...state, updatedAt: Date.now() }
    if (state.profile !== prev.profile) state.profileUpdatedAt = Date.now()
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l())
  if (!fromSync) onChange?.(state)
}

export function replaceState(next: AppState) {
  setState(() => ({ ...empty, ...next }))
}

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => select(state),
  )
}

// keep tabs in sync (laptop with two windows, etc.)
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = load()
    listeners.forEach((l) => l())
  }
})
