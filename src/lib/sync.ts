import { createClient, type Session } from '@supabase/supabase-js'
import type { AppState } from '../types'
import { getState, onLocalChange, setState } from './store'

const URL = 'https://vcxolpdzsnmytdbxnlyu.supabase.co'
const KEY = 'sb_publishable_1EG84hjrk8X2b9Yw0BuCwA_Pp0GAffL'

export const supabase = createClient(URL, KEY)

type Status = 'off' | 'syncing' | 'ok' | 'error'
let status: Status = 'off'
let lastError = ''
const subs = new Set<() => void>()
const setStatus = (s: Status, err = '') => {
  status = s
  lastError = err
  subs.forEach((f) => f())
}
export const syncStatus = () => ({ status, lastError })
export const onSyncStatus = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

/** Union by id, drop tombstoned, newest wins for profile/active. */
export function merge(a: AppState, b: AppState): AppState {
  const deleted = [...new Set([...(a.deleted ?? []), ...(b.deleted ?? [])])]
  const del = new Set(deleted)
  const byId = <T extends { id: string }>(x: T[], y: T[]) => {
    const m = new Map<string, T>()
    for (const i of [...x, ...y]) if (!del.has(i.id)) m.set(i.id, i)
    return [...m.values()]
  }
  const weights = new Map<string, { date: string; lbs: number }>()
  const [older, newer] = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? [b, a] : [a, b]
  for (const w of [...older.weights, ...newer.weights]) weights.set(w.date, w)
  const profileFrom = (a.profileUpdatedAt ?? 0) >= (b.profileUpdatedAt ?? 0) ? a : b
  return {
    version: 1,
    profile: profileFrom.profile ?? older.profile ?? newer.profile,
    profileUpdatedAt: profileFrom.profileUpdatedAt,
    workouts: byId(a.workouts, b.workouts).sort((x, y) => x.start - y.start),
    foods: byId(a.foods, b.foods).sort((x, y) => x.ts - y.ts),
    weights: [...weights.values()].sort((x, y) => x.date.localeCompare(y.date)),
    active: newer.active,
    deleted: deleted.slice(-2000),
    updatedAt: Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0),
  }
}

let session: Session | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let running = false

export async function syncNow() {
  if (!session || running) return
  running = true
  setStatus('syncing')
  try {
    const uid = session.user.id
    const { data, error } = await supabase.from('app_state').select('data').eq('user_id', uid).maybeSingle()
    if (error) throw error
    const remote = data?.data as AppState | undefined
    if (remote) setState((s) => merge(s, remote), true)
    const merged = getState()
    const { error: upErr } = await supabase.from('app_state').upsert({ user_id: uid, data: merged, updated_at: new Date().toISOString() })
    if (upErr) throw upErr
    setStatus('ok')
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
  } finally {
    running = false
  }
}

export function initSync(onSession: (s: Session | null) => void) {
  supabase.auth.getSession().then(({ data }) => {
    session = data.session
    onSession(session)
    if (session) void syncNow()
  })
  supabase.auth.onAuthStateChange((_e, s) => {
    const was = session
    session = s
    onSession(s)
    if (s && !was) void syncNow()
    if (!s) setStatus('off')
  })
  onLocalChange(() => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 1500)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
}
