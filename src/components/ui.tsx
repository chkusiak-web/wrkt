import type { ReactNode } from 'react'

export function Stepper({ value, onChange, step = 1, label, min = 0 }: { value: number; onChange: (n: number) => void; step?: number; label: string; min?: number }) {
  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button type="button" className="step-btn" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label={`less ${label}`}>−</button>
        <input
          className="step-val"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="step-btn" onClick={() => onChange(+(value + step).toFixed(2))} aria-label={`more ${label}`}>+</button>
      </div>
    </div>
  )
}

export function Bar({ value, max, color = 'var(--accent)', label, right }: { value: number; max: number; color?: string; label?: ReactNode; right?: ReactNode }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = max > 0 && value > max
  return (
    <div className="bar-wrap">
      {(label || right) && (
        <div className="bar-head">
          <span>{label}</span>
          <span className={over ? 'warn' : ''}>{right}</span>
        </div>
      )}
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%`, background: over ? 'var(--warn)' : color }} />
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
