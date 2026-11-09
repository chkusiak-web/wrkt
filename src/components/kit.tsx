import { useEffect, useRef, type ReactNode } from 'react'
import type React from 'react'
import { Led } from '../led/Led'

/** A full-height screen with the mockup's padding. */
export function Screen({ children, className = '', scroll = false }: { children: ReactNode; className?: string; scroll?: boolean }) {
  return <div className={`scr ${scroll ? 'scroll' : ''} ${className}`}>{children}</div>
}

export function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="link" onClick={onClick}>
      ‹ {label}
    </button>
  )
}

export function Bar({ left, right, center }: { left?: ReactNode; right?: ReactNode; center?: ReactNode }) {
  return (
    <div className="topbar">
      <div className="tb-l">{left}</div>
      {center !== undefined && <div className="tb-c">{center}</div>}
      <div className="tb-r">{right}</div>
    </div>
  )
}

/** Bottom row: a quiet action on each side, the main button in the middle. Same spot on every screen. */
export function Bottom({ left, main, right }: { left?: ReactNode; main?: ReactNode; right?: ReactNode }) {
  return (
    <div className="bottom3">
      <div className="b-l">{left}</div>
      <div className="b-m">{main}</div>
      <div className="b-r">{right}</div>
    </div>
  )
}

export const Label = ({ children }: { children: ReactNode }) => <div className="label">{children}</div>

/** One tap is one step; keep pressing and it repeats, faster the longer you hold. */
export function HoldBtn({ onStep, label, children, className = 'round' }: { onStep: () => void; label: string; children: ReactNode; className?: string }) {
  const fn = useRef(onStep)
  fn.current = onStep
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stop = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        stop()
        let n = 0
        fn.current()
        const go = () => {
          fn.current()
          n++
          timer.current = setTimeout(go, n < 6 ? 110 : 45)
        }
        timer.current = setTimeout(go, 380)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.detail === 0) fn.current() // keyboard
      }}
    >
      {children}
    </button>
  )
}

/** A number in lights with round − / + buttons either side. */
export function LedStepper({
  label, value, onChange, step = 1, min = 0, max = 999, fitStr = '88', fmt = (v: number) => String(v), w = 150, h = 64, onTapValue,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  fitStr?: string
  fmt?: (v: number) => string
  w?: number
  h?: number
  onTapValue?: () => void
}) {
  const val = useRef(value)
  val.current = value
  const set = (d: number) => {
    const n = Math.round(Math.max(min, Math.min(max, val.current + d)) * 100) / 100
    val.current = n
    onChange(n)
  }
  const str = fmt(value)
  return (
    <div className="lstep">
      {label && <span className="lstep-l">{label}</span>}
      <div className="lstep-row">
        <HoldBtn label={`Less ${label}`} onStep={() => set(-step)}>−</HoldBtn>
        <div className="led-box" style={{ width: w, height: h }} onClick={onTapValue} role={onTapValue ? 'button' : undefined}>
          <Led cfg={{ fit: true, maxPitch: 8, bare: true, text: { str, fitStr: fitStr.length >= str.length ? fitStr : str, S: 1 } }} label={`${str} ${label}`} />
        </div>
        <HoldBtn label={`More ${label}`} onStep={() => set(step)}>+</HoldBtn>
      </div>
    </div>
  )
}

export function Chips<T extends string | number>({ options, value, onChange, small }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={`chips ${small ? 'sm' : ''}`} role="group">
      {options.map((o) => (
        <button type="button" key={String(o.value)} className={`chip ${o.value === value ? 'on' : ''}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Drag to reorder: put data-drag on each item (siblings in one container) and spread handle(i) on its grip.
 * The item follows your finger and the others slide out of the way; the new order is saved when you let go.
 * onMove(from, to) moves one item from index from to index to.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const st = useRef<{ i: number; y: number; el: HTMLElement; sibs: HTMLElement[]; to: number } | null>(null)
  const move = useRef(onMove)
  move.current = onMove
  const clear = () => {
    const s = st.current
    if (!s) return
    for (const el of [s.el, ...s.sibs]) {
      el.style.transform = ''
      el.style.transition = ''
    }
    s.el.classList.remove('dragging')
    st.current = null
  }
  return (i: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      const el = e.currentTarget.closest('[data-drag]') as HTMLElement | null
      if (!el?.parentElement) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const sibs = [...el.parentElement.children].filter((c) => c !== el && c.hasAttribute('data-drag')) as HTMLElement[]
      for (const c of sibs) c.style.transition = 'transform 150ms ease'
      st.current = { i, y: e.clientY, el, sibs, to: i }
      el.classList.add('dragging')
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = st.current
      if (!s) return
      const dy = e.clientY - s.y
      s.el.style.transform = `translateY(${dy}px)`
      const h = s.el.getBoundingClientRect().height
      const all = [...s.el.parentElement!.children].filter((c) => c.hasAttribute('data-drag')) as HTMLElement[]
      // the slot the dragged item's middle is over, counting the others' resting positions
      const r0 = s.el.getBoundingClientRect()
      const mid = r0.top + r0.height / 2
      let to = s.i
      for (let k = 0; k < all.length; k++) {
        const c = all[k]
        if (c === s.el) continue
        const r = c.getBoundingClientRect()
        const restTop = r.top - (parseFloat(c.style.transform.replace(/[^-\d.]/g, '')) || 0)
        const cm = restTop + r.height / 2
        if (k < s.i && mid < cm) to = Math.min(to, k)
        if (k > s.i && mid > cm) to = Math.max(to, k)
      }
      s.to = to
      all.forEach((c, k) => {
        if (c === s.el) return
        const shift = to < s.i && k >= to && k < s.i ? h : to > s.i && k <= to && k > s.i ? -h : 0
        c.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    },
    onPointerUp: () => {
      const s = st.current
      clear()
      if (s && s.to !== s.i) move.current(s.i, s.to)
    },
    onPointerCancel: clear,
  })
}

/** Move one item in a list from one index to another. */
export function moveItem<T>(list: T[], from: number, to: number) {
  const out = [...list]
  const [x] = out.splice(from, 1)
  out.splice(to, 0, x)
  return out
}
