import { LEVELS, type Stage } from './xp'

const NAMES = ['egg-1', 'egg-3', 'egg-4', 'stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5', 'ash-1', 'ash-2', 'ash-3', 'ash-4', 'ash-5', 'gold-raised', 'flame-ref3', 'roost']

let loading: Promise<Record<string, HTMLImageElement>> | null = null
export function loadArt() {
  loading ??= Promise.all(
    NAMES.map(
      (n) =>
        new Promise<[string, HTMLImageElement]>((res, rej) => {
          const im = new Image()
          im.onload = () => res([n, im])
          im.onerror = rej
          im.src = `${import.meta.env.BASE_URL}phoenix/${n}.png`
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs))
  return loading
}

export function spriteName(stage: Stage, level: number, ash: boolean) {
  if (ash) return typeof stage === 'number' ? `ash-${stage}` : 'ash-1'
  if (stage === 'egg1') return 'egg-1'
  if (stage === 'egg2') return 'egg-3'
  if (stage === 'egg3') return 'egg-4'
  if (stage === 5 && level === LEVELS.length - 1) return 'gold-raised'
  return `stage-${stage}`
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

/** Gradient-map along a ramp of colors (t in 0..1). */
function ramp(cols: number[][], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (cols.length - 1)
  const i = Math.min(cols.length - 2, Math.floor(x))
  const f = x - i
  return cols[i].map((v, k) => Math.round(v + (cols[i + 1][k] - v) * f))
}

const cache = new Map<string, HTMLCanvasElement>()

/** The bird re-skinned in the level's colors: saturated (fire) pixels are mapped by brightness onto the level ramp. */
export function birdCanvas(im: HTMLImageElement, name: string, level: number) {
  const key = `${name}:${level}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = im.width
  c.height = im.height
  const x = c.getContext('2d')!
  x.drawImage(im, 0, 0)
  if (level > 0 && !name.startsWith('ash') && name !== 'gold-raised') {
    const d = x.getImageData(0, 0, c.width, c.height)
    const px = d.data
    const cols = LEVELS[level].light.map(hex)
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue
      const r = px[i], g = px[i + 1], b = px[i + 2]
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const sat = mx === 0 ? 0 : (mx - mn) / mx
      if (sat < 0.3) continue // outlines, eyes, highlights stay as drawn
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const [nr, ng, nb] = ramp(cols, 0.08 + lum * 1.05)
      px[i] = nr
      px[i + 1] = ng
      px[i + 2] = nb
    }
    x.putImageData(d, 0, 0)
  }
  cache.set(key, c)
  return c
}

export const FLAME = { w: 62, h: 81, n: 9 }

/** The flame strip recolored: its red channel stores a band 0 (core) .. 3 (rim). */
export function flameSheet(im: HTMLImageElement, level: number) {
  const key = `flame:${level}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = im.width
  c.height = im.height
  const x = c.getContext('2d')!
  x.drawImage(im, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height)
  const px = d.data
  const L = LEVELS[level].light
  const bands = (level === 0 ? ['#fffbe0', '#ffe04a', '#ff9d1c', '#e0401a'] : [L[4], L[3], L[2], L[1]]).map(hex)
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue
    const band = Math.min(3, Math.max(0, Math.round((px[i] - 10) / 80)))
    ;[px[i], px[i + 1], px[i + 2]] = bands[band]
  }
  x.putImageData(d, 0, 0)
  cache.set(key, c)
  return c
}
