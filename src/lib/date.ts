export const dayKey = (d: Date = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (k: string, n: number) => {
  const d = parseDay(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export const fmtDay = (k: string) =>
  parseDay(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** The app's day runs 4am to 4am, so a late-night snack or workout counts for the day before. */
export const DAY_START_HOURS = 4
export const today = (ts: number = Date.now()) => dayKey(new Date(ts - DAY_START_HOURS * 3600_000))

/** Monday of the week containing day k. */
export const weekStart = (k: string) => {
  const dow = (parseDay(k).getDay() + 6) % 7
  return addDays(k, -dow)
}

export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
