// LED engine: every light is its own node. Brightness 0..1 maps onto the level's ramp: off, deep, low, mid, high, core.
// Ported from the design mockup's engine so the app's lights match it node for node.
import flameData from './flame3.json'

type RGB = [number, number, number]
export type AnchorRef = { current: HTMLElement | null }

export interface FlameRef {
  w: number
  h: number
  frames: string[]
  fps?: number
  base?: number
  sy?: number
}

export const FLAME_REF: FlameRef = { ...(flameData as { w: number; h: number; frames: string[] }), fps: 10, base: 0.3 }

export interface CountCfg {
  from?: number
  to?: number
  delay?: number
  dur?: number
  seq?: [number, number][]
  pre?: string
  post?: string
}

export interface TextCfg {
  str?: string
  get?: () => string
  count?: CountCfg
  at?: AnchorRef
  cx?: number
  cy?: number
  S: number
  gap?: number
  fitStr?: string
}

export interface LedCfg {
  pitch?: number
  bare?: boolean
  floor?: number
  fit?: boolean
  maxPitch?: number
  orb?: { at?: AnchorRef; x?: number; y?: number; r: number; k?: number; ref?: FlameRef }
  burst?: { delay?: number; rings?: number[]; r0?: number; reach?: number }
  meter?: { frac: number }
  mbar?: { at: AnchorRef; frac: number }
  shape?: 'chevron' | 'ripple'
  cx?: number
  cy?: number
  line?: { vals: number[]; lo: number; hi: number; span?: number; loop?: number }
  bars?: { vals: number[]; x: number; y: number; w: number; h: number; rel?: boolean; gap?: number; loop?: number }
  flame?: number
  flameAmp?: number
  /** follows the screen transition (GO) fill; defaults to true for flames */
  fills?: boolean
  text?: TextCfg
}

export interface LedInst {
  el: HTMLCanvasElement
  cfg: LedCfg
  t0: number
  mk?: string
  mask?: Mask
}

type Mask = Map<number, 1 | 2> & { y0?: number; th?: number; offset?: number }

// ---- shared state: palette ramp, transition fill, reduced motion ----
let R: [number, RGB][] = []
export const motion = {
  reduce: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  fill: 0,
}

const hx = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
export function setRamp(c: readonly string[]) {
  R = [[0, [30, 26, 31]], [0.16, hx(c[0])], [0.36, hx(c[1])], [0.58, hx(c[2])], [0.8, hx(c[3])], [1, hx(c[4])]]
}
setRamp(['#3E100A', '#F2361B', '#FF6A3D', '#FFC23D', '#FFF1D6'])

const G: Record<string, string[]> = {
  '0': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
  ':': ['00000', '00000', '00100', '00000', '00100', '00000', '00000'],
}

interface Span { c: string; lo: number; w: number; blank?: boolean }

export function textSpans(str: string, S: number, gapN?: number) {
  const gap = gapN == null ? 2 * S : gapN
  const spans: Span[] = String(str)
    .split('')
    .filter((c) => G[c] || c === ' ')
    .map((c) => {
      if (c === ' ') return { c, lo: 0, w: S, blank: true }
      let lo = 5
      let hi = -1
      G[c].forEach((row) => {
        for (let k = 0; k < 5; k++) if (row[k] === '1') { lo = Math.min(lo, k); hi = Math.max(hi, k) }
      })
      return { c, lo, w: (hi - lo + 1) * S }
    })
  // punctuation sits closer to its neighbours than a full letter gap
  const tight = (c: string) => c === '.' || c === ','
  const gapAt = (q: number) => (tight(spans[q].c) || (spans[q + 1] && tight(spans[q + 1].c)) ? S : gap)
  const tw = spans.reduce((a, s, q) => a + s.w + (q < spans.length - 1 ? gapAt(q) : 0), 0)
  return { spans, gapAt, tw, th: 7 * S }
}

const key2 = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096)

function textMask(str: string, ci: number, cj: number, S: number, gapN?: number): Mask {
  const T = textSpans(str, S, gapN)
  const left = ci - (T.tw - 1) / 2
  const x0 = Math.floor(left)
  const y0 = Math.round(cj - (T.th - 1) / 2)
  const m: Mask = new Map()
  for (let j = y0 - 1; j <= y0 + T.th; j++) for (let i = x0 - 1; i <= x0 + T.tw; i++) m.set(key2(i, j), 2)
  let gx = x0
  T.spans.forEach((s, q) => {
    if (!s.blank)
      G[s.c].forEach((row, r) => {
        for (let k = s.lo; k < 5; k++)
          if (row[k] === '1') for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) m.set(key2(gx + (k - s.lo) * S + a, y0 + r * S + b), 1)
      })
    gx += s.w + (q < T.spans.length - 1 ? T.gapAt(q) : 0)
  })
  m.y0 = y0
  m.th = T.th
  m.offset = left - x0 // sub-node shift so the text sits on its true center
  return m
}

function anchorAt(el: HTMLElement, a?: AnchorRef) {
  const n = a?.current
  if (!n) return null
  const r = el.getBoundingClientRect()
  const q = n.getBoundingClientRect()
  if (!r.width || !r.height) return null
  return { x: (q.left + q.width / 2 - r.left) / r.width, y: (q.top + q.height / 2 - r.top) / r.height }
}

function anchorBox(el: HTMLElement, a?: AnchorRef) {
  const n = a?.current
  if (!n) return null
  const r = el.getBoundingClientRect()
  const q = n.getBoundingClientRect()
  if (!r.width || !r.height) return null
  return { x0: (q.left - r.left) / r.width, x1: (q.right - r.left) / r.width, y: (q.top + q.height / 2 - r.top) / r.height }
}

/** ms since the canvas appeared (reduced motion: everything has already happened) */
const since = (c: LedInst) => (motion.reduce ? 1e9 : performance.now() - c.t0)

export function countNow(C: CountCfg, el: number) {
  let val = C.from || 0
  let end = 0
  for (const sg of C.seq || [[C.delay || 0, C.to ?? 0]]) {
    const q = Math.max(0, Math.min(1, (el - sg[0]) / (C.dur || 700)))
    const e = 1 - Math.pow(1 - q, 3)
    val = val + (sg[1] - val) * e
    end = sg[0] + (C.dur || 700)
  }
  return { str: (C.pre || '') + Math.round(val) + (C.post || ''), pulse: Math.max(0, 1 - Math.max(0, el - end) / 600) * (el >= end ? 1 : 0) }
}

interface Draw {
  p: number
  fill: number
  pulse: number
  orbXY: { x: number; y: number } | null
  orbGrow: number
  rings: { r: number; a: number }[] | null
  MB: { i0: number; i1: number; j: number } | null
  reveal: number | null
  barsNow: number[] | null
  BL: { start: number; bw: number; g: number; n: number; j0: number; j1: number } | null
}

// a soft wave of light: one continuous gradient per period, a long slow rise to the crest, then a quick soft fall
const wave = (ph: number, P: number) => {
  const g = ph / P
  const c = 0.78
  return g < c ? Math.pow(g / c, 1.6) : 0.5 + 0.5 * Math.cos((Math.PI * (g - c)) / (1 - c))
}

function field(D: Draw, cfg: LedCfg, x: number, y: number, i: number, j: number, t: number, w: number, h: number, mask: Mask | null) {
  let v = 0
  const u = x / w
  const yy = y / h
  if (cfg.orb && D.orbXY) {
    const m = Math.min(w, h)
    const dx = (x - w * D.orbXY.x) / m
    const dy = (y - h * D.orbXY.y) / m
    const d = Math.sqrt(dx * dx + dy * dy * 1.1)
    const FR = cfg.orb.ref
    if (FR) {
      // the fire behind the bird, sampled from the reference flame's own frames, node by node
      const bw2 = cfg.orb.r * m * 2 * D.orbGrow
      const bh2 = ((bw2 * FR.h) / FR.w) * (FR.sy || 1)
      const fx2 = (x - (w * D.orbXY.x - bw2 / 2)) / bw2
      const fy2 = (y - (h * D.orbXY.y + bh2 * (FR.base || 0.38) - bh2)) / bh2
      if (fx2 >= 0 && fx2 < 1 && fy2 >= 0 && fy2 < 1) {
        const fpos = (t * (FR.fps || 10)) % FR.frames.length
        const f0 = Math.floor(fpos)
        const f1 = (f0 + 1) % FR.frames.length
        const fb = fpos - f0
        const ci2 = Math.min(FR.w - 1, Math.floor(fx2 * FR.w))
        const cj2 = Math.min(FR.h - 1, Math.floor(fy2 * FR.h))
        const q2 = cj2 * FR.w + ci2
        const a0 = parseInt(FR.frames[f0][q2], 36) / 35
        const a1 = parseInt(FR.frames[f1][q2], 36) / 35
        v = (a0 + (a1 - a0) * fb) * (cfg.orb.k || 1)
      }
    } else {
      const o = 1 - (d + 0.035 * Math.sin(t * 1.1 + Math.atan2(dy, dx) * 3) + 0.02 * Math.sin(t * 0.7 + d * 18)) / Math.max(0.001, cfg.orb.r * D.orbGrow)
      if (o > 0) v = Math.pow(o, 1.35) * (cfg.orb.k || 1)
    }
    if (D.rings)
      for (const R0 of D.rings) {
        // power-up: rings of light thrown out from the bird, fading as they travel
        if (R0.a > 0) {
          const dd = Math.abs(d - R0.r)
          const th = (D.p / m) * 1.6
          if (dd < th) v = Math.max(v, ((0.72 + 0.26 * R0.a) * (1 - dd / th) * Math.sqrt(R0.a) + 0.1) * Math.min(1, Math.min(y, h - y) / (h * 0.2)))
        }
      }
  }
  if (cfg.meter) {
    // a progress meter: one row of lights, lit left to right
    const fr = (x + 0.5) / w
    v = Math.max(v, fr <= cfg.meter.frac ? 0.5 + (0.3 * fr) / Math.max(0.01, cfg.meter.frac) : 0.1)
  }
  if (D.MB && cfg.mbar && j === D.MB.j && i >= D.MB.i0 && i <= D.MB.i1) {
    // the progress meter is a row of the grid itself, so its lights sit on the grid
    const nM = D.MB.i1 - D.MB.i0 + 1
    const fM = (i - D.MB.i0 + 0.5) / nM
    v = fM <= cfg.mbar.frac ? 0.5 + (0.3 * fM) / Math.max(0.01, cfg.mbar.frac) : 0.13
  }
  if (cfg.shape === 'chevron') {
    // wide chevrons pointing right, rolling forward
    const sc = x + Math.abs(y - h * 0.5) * 0.7
    const P = w * 0.62
    const ph = (((sc - t * w * 0.11) % P) + P) % P
    v = Math.max(v, (0.2 + 0.72 * wave(ph, P)) * (0.75 + 0.25 * u))
  }
  if (cfg.shape === 'ripple') {
    // wide soft rings spreading out, like a stone dropped in a pond
    const cxr = w * (cfg.cx || 0.5)
    const cyr = h * (cfg.cy || 0.5)
    const rr = Math.sqrt((x - cxr) * (x - cxr) + (y - cyr) * (y - cyr))
    const Rm = Math.max(w, h) * 0.5
    const Pr = Math.min(w, h) * 0.62
    const phr = (((rr - t * Rm * 0.1) % Pr) + Pr) % Pr
    const fade = Math.max(0, 1 - rr / Rm)
    v = Math.max(v, 0.2 + (0.4 + 0.35 * fade) * wave(phr, Pr))
  }
  if (cfg.line) {
    // a trend line in lights with a faint glow filled underneath
    const L = cfg.line
    const uL = u / (L.span || 1)
    const n = L.vals.length
    const fx = Math.max(0, Math.min(n - 1, uL * (n - 1)))
    const k0 = Math.floor(fx)
    const k1 = Math.min(n - 1, k0 + 1)
    const val = L.vals[k0] + (L.vals[k1] - L.vals[k0]) * (fx - k0)
    const yl = h * (0.1 + 0.8 * (1 - (val - L.lo) / (L.hi - L.lo)))
    const rev = D.reveal == null ? 1 : D.reveal
    if (uL > Math.min(1, rev) + 0.001 || n < 2) return v
    const dy2 = y - yl
    const tip = uL > rev - 0.03 ? 0.15 : 0
    if (Math.abs(dy2) <= D.p * 0.75) v = Math.max(v, 0.62 + 0.25 * uL + tip)
    else if (dy2 > 0) v = Math.max(v, 0.3 * Math.max(0, 1 - dy2 / (h * 0.55)))
  }
  if (cfg.bars && D.BL) {
    // bars live on whole nodes: every bar is the same number of columns, every gap the same
    const BL = D.BL
    const rel = i - BL.start
    const per = BL.bw + BL.g
    const k = Math.floor(rel / per)
    if (j >= BL.j0 && j <= BL.j1 && rel >= 0 && k < BL.n && rel % per < BL.bw) {
      const bv = (D.barsNow || cfg.bars.vals)[k]
      const hRows = Math.round(bv * (BL.j1 - BL.j0 + 1))
      if (hRows > 0 && j > BL.j1 - hRows) v = Math.max(v, (k === BL.n - 1 ? 0.74 : 0.36 + (0.24 * k) / BL.n) + (0.16 * (j - (BL.j1 - hRows))) / (BL.j1 - BL.j0 + 1))
    }
  }
  let fl = 0
  if (cfg.flame != null) {
    const base = cfg.flame
    const amp = cfg.flameAmp || 1
    const edge = base - D.fill * (base + 0.45) + amp * (0.035 * Math.sin(u * 3.4 + t * 0.5) + 0.02 * Math.sin(u * 8.1 - t * 0.9))
    const s = yy - edge
    if (s > -0.04) {
      // brightness follows height: hot at the bottom, deep at the top, one smooth gradient
      const hot = 0.28 + 0.66 * Math.pow(Math.max(0, Math.min(1, yy)), 1.6)
      const lick = 0.035 * Math.sin(u * 4.1 + t * 0.7) + 0.025 * Math.sin(yy * 6 - t * 0.9 + u * 2)
      const on = 1 - Math.exp(-(s + 0.04) * 18)
      fl = Math.max(0, Math.min(1, (hot + lick) * on))
      v = Math.max(fl, v * (1 - on))
    }
  }
  if (mask) {
    const mk = mask.get(key2(i, j))
    if (mk === 1) {
      if (D.fill > 0 && fl > 0) return fl
      const ry = (j - (mask.y0 ?? 0)) / ((mask.th ?? 7) - 1)
      return 0.42 + 0.5 * ry + 0.08 * Math.sin(t * 2.2 + i * 0.5 - j * 0.6) + 0.4 * D.pulse
    }
    if (mk === 2) return D.fill > 0 && fl > 0 ? fl : v * 0.25
  }
  return v
}

const hash = (i: number, j: number) => {
  let x = (i * 374761393 + j * 668265263) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295
}
const col = (c3: RGB, k: number) => `rgb(${Math.min(255, (c3[0] * k) | 0)},${Math.min(255, (c3[1] * k) | 0)},${Math.min(255, (c3[2] * k) | 0)})`
const ramp = (v: number): RGB => {
  v = Math.max(0, Math.min(1, v || 0))
  for (let q = 1; q < R.length; q++)
    if (v <= R[q][0]) {
      const a = R[q - 1]
      const b = R[q]
      const f = (v - a[0]) / (b[0] - a[0])
      return [a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f]
    }
  return R[R.length - 1][1]
}

/** The string a canvas shows right now (live text, counting text or fixed). */
export function textNow(c: LedInst) {
  const tc = c.cfg.text
  if (!tc) return { str: '', pulse: 0 }
  if (tc.count) return countNow(tc.count, since(c))
  return { str: tc.get ? tc.get() : (tc.str ?? ''), pulse: 0 }
}

export function drawLed(c: LedInst, t: number) {
  const el = c.el
  const cfg = c.cfg
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h || !cfg) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
  }
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // bare lights sit straight on whatever is behind them (black page or a charcoal card)
  if (cfg.bare) ctx.clearRect(0, 0, w, h)
  else {
    ctx.fillStyle = '#0A090B'
    ctx.fillRect(0, 0, w, h)
  }
  let p = cfg.pitch || 7
  const D: Draw = { p, fill: cfg.fills === false ? 0 : motion.fill, pulse: 0, orbXY: null, orbGrow: 1, rings: null, MB: null, reveal: null, barsNow: null, BL: null }
  let str: string | null = null
  if (cfg.text) {
    const tn = textNow(c)
    str = tn.str
    D.pulse = tn.pulse
  }
  // fit: pick the node pitch so the number fills its box (sized for the widest text it will show)
  if (cfg.fit && cfg.text) {
    const M = textSpans(cfg.text.fitStr && cfg.text.fitStr.length >= (str ?? '').length ? cfg.text.fitStr : (str ?? ''), cfg.text.S, cfg.text.gap)
    p = Math.max(2.5, Math.min(cfg.maxPitch || 99, w / (M.tw + 1.2), h / (M.th + 1.2)))
  }
  const rad = p * 0.36
  D.p = p
  if (cfg.orb) D.orbXY = anchorAt(el, cfg.orb.at) || { x: cfg.orb.x ?? 0.5, y: cfg.orb.y ?? 0.5 }
  const cols = Math.ceil(w / p) + 1
  const rows = Math.ceil(h / p) + 1
  let ox = (w - (cols - 1) * p) / 2
  const oy = (h - (rows - 1) * p) / 2
  let mask: Mask | null = null
  if (cfg.text && str != null) {
    const at = anchorAt(el, cfg.text.at) || { x: cfg.text.cx ?? 0.5, y: cfg.text.cy ?? 0.5 }
    const ci = (w * at.x - ox) / p
    const cj = (h * at.y - oy) / p
    const key = [str, cols, rows, ci.toFixed(2), cj.toFixed(2), cfg.text.S, cfg.text.gap].join('|')
    if (c.mk !== key) {
      c.mk = key
      c.mask = textMask(str, ci, cj, cfg.text.S, cfg.text.gap)
    }
    mask = c.mask ?? null
    if (mask?.offset) ox += mask.offset * p
  }
  if (cfg.mbar) {
    const mb = anchorBox(el, cfg.mbar.at)
    if (mb) D.MB = { i0: Math.ceil((w * mb.x0 - ox) / p), i1: Math.floor((w * mb.x1 - ox) / p), j: Math.round((h * mb.y - oy) / p) }
  }
  const el2 = since(c)
  if (cfg.burst && cfg.orb) {
    // the orb swells in from nothing, then rings roll outward
    const B2 = cfg.burst
    const q2 = Math.max(0, Math.min(1, (el2 - (B2.delay || 0)) / 700))
    D.orbGrow = q2 < 1 ? Math.sin((q2 * Math.PI) / 2) * (1 + 0.25 * Math.sin(q2 * Math.PI)) : 1
    D.rings = (B2.rings || [300, 650, 1000]).map((st) => {
      const e3 = (el2 - (B2.delay || 0) - st) / 1300
      return { r: (B2.r0 || 0.1) + e3 * (B2.reach || 0.7), a: e3 < 0 || e3 > 1 ? 0 : Math.pow(1 - e3, 1.5) }
    })
  }
  // looping draw-ins: a line that writes itself left to right, bars that grow one after another
  const loopT = motion.reduce ? 1e9 : el2 / 1000
  if (cfg.line?.loop) {
    const lq = (loopT % cfg.line.loop) / (cfg.line.loop * 0.7)
    D.reveal = motion.reduce ? 1 : Math.min(1, lq)
  }
  if (cfg.bars?.loop) {
    const bt = motion.reduce ? 99 : loopT % cfg.bars.loop
    D.barsNow = cfg.bars.vals.map((bv, k) => {
      const bq = Math.max(0, Math.min(1, (bt - k * 0.4) / 1.3))
      return bv * (1 - Math.pow(1 - bq, 3))
    })
  }
  if (cfg.bars) {
    const B = cfg.bars
    const bx = B.rel ? B.x * w : B.x
    const by = B.rel ? B.y * h : B.y
    const bw = B.rel ? B.w * w : B.w
    const bh = B.rel ? B.h * h : B.h
    const ci0 = Math.ceil((bx - ox) / p)
    const ci1 = Math.floor((bx + bw - ox) / p)
    const N = ci1 - ci0 + 1
    const nb = B.vals.length
    const g = B.gap || 2
    const bwN = Math.max(1, Math.floor((N - (nb - 1) * g) / nb))
    const used = nb * bwN + (nb - 1) * g
    D.BL = { start: ci0 + Math.floor((N - used) / 2), bw: bwN, g, n: nb, j0: Math.ceil((by - oy) / p), j1: Math.floor((by + bh - oy) / p) }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = ox + i * p
      const y = oy + j * p
      const n = hash(i, j)
      let v = field(D, cfg, x, y, i, j, t, w, h, mask)
      if (cfg.bare && v < 0.1) continue // bare: only lit nodes show, no charcoal grid
      if (v > 0) v = Math.max(0, Math.min(1, v + (n - 0.5) * 0.12))
      if (cfg.floor) v = Math.max(v, cfg.floor + (n - 0.5) * 0.04) // panels glow faintly all over, brighter in the shape
      const c3 = ramp(v)
      const k = 0.94 + n * 0.12
      if (v > 0.5) {
        ctx.globalAlpha = 0.14 * v
        ctx.fillStyle = col(c3, 1)
        ctx.beginPath()
        ctx.arc(x, y, rad * 1.45, 0, 6.2832)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = col(c3, k)
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, 6.2832)
      ctx.fill()
      if (v > 0.2) {
        ctx.fillStyle = col(c3, k * 1.18 + 0.05)
        ctx.beginPath()
        ctx.arc(x - rad * 0.18, y - rad * 0.18, rad * 0.5, 0, 6.2832)
        ctx.fill()
      }
    }
}

// ---- one ticker for every canvas on screen, ~20 fps ----
const live = new Set<LedInst>()
const frameHooks = new Set<() => void>()
let raf = 0
let last = 0
let goAt = 0
let arriveAt = 0

function stepFill(ts: number) {
  let q: number
  if (goAt) {
    q = Math.min(1, (ts - goAt) / 1100)
    motion.fill = q * q * (3 - 2 * q)
  } else if (arriveAt) {
    q = Math.min(1, (ts - arriveAt) / 900)
    motion.fill = 1 - q * q * (3 - 2 * q)
    if (q >= 1) arriveAt = 0
  }
}

function tick(ts: number) {
  raf = 0
  if (document.visibilityState === 'visible' && (!last || ts - last > 50)) {
    last = ts
    stepFill(ts)
    frameHooks.forEach((f) => f())
    for (const c of live) drawLed(c, motion.reduce ? 0 : ts / 1000)
  }
  if (live.size || frameHooks.size) raf = requestAnimationFrame(tick)
}
const kick = () => {
  if (!raf) raf = requestAnimationFrame(tick)
}

export function register(c: LedInst) {
  live.add(c)
  drawLed(c, motion.reduce ? 0 : performance.now() / 1000)
  kick()
  return () => void live.delete(c)
}

export function onFrame(f: () => void) {
  frameHooks.add(f)
  kick()
  return () => void frameHooks.delete(f)
}

/** Tap GO: the flame climbs over everything, then the next screen takes over and it drains away. */
export function flameTransition(then: () => void) {
  if (motion.reduce) return then()
  if (goAt) return
  goAt = performance.now()
  kick()
  setTimeout(() => {
    goAt = 0
    motion.fill = 1
    arriveAt = performance.now()
    then()
  }, 1150)
}
