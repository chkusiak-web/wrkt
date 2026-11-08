import { useSyncExternalStore } from 'react'
import type { Equipment, PlanBlock } from '../types'
import { today } from './date'

/** The Up next plan as you've changed it before starting: a picked workout, swaps, new order, equipment. */
export interface Draft {
  day: string
  planId: string
  blocks: PlanBlock[]
  /** slots changed from the bank plan, shown as "swapped" */
  swapped: string[]
  /** true when you picked it from the bank instead of taking the coach's pick */
  picked: boolean
}

let draft: Draft | null = null
let eq: Equipment | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function setDraft(d: Omit<Draft, 'day'> | null) {
  draft = d ? { ...d, day: today() } : null
  emit()
}
export function getDraft() {
  return draft && draft.day === today() ? draft : null
}
export const setDraftEq = (e: Equipment | null) => {
  eq = e
  emit()
}
export const getDraftEq = () => eq

export function useDraft() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => void subs.delete(l)
    },
    getDraft,
  )
}
export function useDraftEq() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l)
      return () => void subs.delete(l)
    },
    () => eq,
  )
}
