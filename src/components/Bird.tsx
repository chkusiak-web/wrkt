import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'
import { birdCanvas, loadArt, spriteName } from '../lib/phoenixArt'
import { LEVELS, type PhoenixState } from '../lib/xp'

/** The phoenix sprite at whole-pixel scale, recolored for its level. */
const Bird = forwardRef<HTMLCanvasElement, { p: PhoenixState; className?: string; style?: CSSProperties }>(function Bird({ p, className, style }, fwd) {
  const ref = useRef<HTMLCanvasElement>(null)
  useImperativeHandle(fwd, () => ref.current!)
  const name = spriteName(p.stage, p.level, p.ash)
  useEffect(() => {
    let alive = true
    void loadArt().then((art) => {
      const cv = ref.current
      if (!alive || !cv || !art[name]) return
      const src = birdCanvas(art[name], name, p.level)
      const W = cv.clientWidth || 150
      const H = cv.clientHeight || 144
      const k = Math.max(1, Math.floor(Math.min(W / src.width, H / src.height)))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      const ctx = cv.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const w = src.width * k
      const h = src.height * k
      ctx.drawImage(src, Math.round((W - w) / 2), Math.round(H - h - (H - h) * 0.35), w, h)
    })
    return () => {
      alive = false
    }
  }, [name, p.level])
  return <canvas ref={ref} className={className} style={{ imageRendering: 'pixelated', ...style }} role="img" aria-label={`Your phoenix: ${LEVELS[p.level].name}${p.ash ? ', burned to ash' : ''}`} />
})

export default Bird
