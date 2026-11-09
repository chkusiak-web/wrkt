import { useEffect, useRef, type CSSProperties } from 'react'
import { register, type LedCfg, type LedInst } from './engine'

/** A canvas of lights. cfg can change every render; the ticker always draws the latest. */
export function Led({ cfg, className, style, label }: { cfg: LedCfg; className?: string; style?: CSSProperties; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const inst = useRef<LedInst | null>(null)
  if (inst.current) inst.current.cfg = cfg
  useEffect(() => {
    if (!ref.current) return
    const c: LedInst = { el: ref.current, cfg, t0: performance.now() }
    inst.current = c
    const off = register(c)
    return () => {
      off()
      inst.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <canvas
      ref={ref}
      className={`led ${className ?? ''}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}

/** A number in lights sized to fill its box. */
export function LedNum({ value, fitStr, w = 150, h = 64, maxPitch = 8, label }: { value: string; fitStr?: string; w?: number; h?: number; maxPitch?: number; label?: string }) {
  return (
    <div className="led-box" style={{ width: w, height: h }}>
      <Led cfg={{ fit: true, maxPitch, bare: true, text: { str: value, fitStr: fitStr ?? value, S: 1 } }} label={label ?? value} />
    </div>
  )
}

/** A row of lights lit left to right. */
export function LedMeter({ frac, h = 9 }: { frac: number; h?: number }) {
  return (
    <div className="led-box" style={{ height: h }}>
      <Led cfg={{ pitch: 7, bare: true, meter: { frac: Math.max(0, Math.min(1, frac)) } }} />
    </div>
  )
}
