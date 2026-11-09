import { useEffect, useRef } from 'react'
import { FLAME, birdCanvas, flameSheet, loadArt, spriteName } from '../lib/phoenixArt'
import { LEVELS, type PhoenixState } from '../lib/xp'

// Virtual canvas: a crop of the roost background, drawn at pixel scale.
const W = 128
const H = 86
const CROP = { x: 192, y: 4 }
const GROUND = 82

interface Spark { x: number; y: number; life: number; max: number }

export default function Roost({ p }: { p: PhoenixState }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef(p)
  state.current = p

  useEffect(() => {
    let raf = 0
    let alive = true
    let frame = 0
    let tick = 0
    let last = 0
    const sparks: Spark[] = []
    loadArt().then((art) => {
      const cv = ref.current
      if (!cv || !alive) return
      const ctx = cv.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      const draw = (ts: number) => {
        if (!alive) return
        raf = requestAnimationFrame(draw)
        if (ts - last < 80) return // ~12 fps, like the art was made for
        last = ts
        tick++
        const s = state.current
        const lv = LEVELS[s.level]
        ctx.clearRect(0, 0, W, H)
        ctx.drawImage(art.roost, CROP.x, CROP.y, W, H, 0, 0, W, H)
        ctx.fillStyle = 'rgba(10,9,11,0.45)'
        ctx.fillRect(0, 0, W, H)

        const name = spriteName(s.stage, s.level, s.ash)
        const bird = birdCanvas(art[name], name, s.level)
        const bx = Math.round(W / 2 - bird.width / 2)
        const by = GROUND - bird.height
        const isEgg = typeof s.stage !== 'number'

        if (!s.ash) {
          const f = s.flame
          // glow
          const gy = GROUND - bird.height * 0.6
          const gr = bird.width * (0.9 + 0.8 * f)
          const g = ctx.createRadialGradient(W / 2, gy, 1, W / 2, gy, gr)
          g.addColorStop(0, lv.light[2])
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.globalAlpha = 0.25 + 0.35 * f
          ctx.fillStyle = g
          ctx.fillRect(W / 2 - gr, gy - gr, gr * 2, gr * 2)
          ctx.globalAlpha = 1
          // flame behind the bird
          if (!isEgg || s.started) {
            frame = (frame + 1) % FLAME.n
            const sheet = flameSheet(art['flame-ref3'], s.level)
            const fw = Math.max(12, Math.round(bird.width * (0.4 + 0.45 * f)))
            const fh = Math.round((fw * FLAME.h) / FLAME.w)
            const fx = Math.round(W / 2 - fw / 2)
            const fy = Math.round(GROUND - bird.height * (isEgg ? 0.15 : 0.3) - fh)
            ctx.globalAlpha = 0.35 + 0.65 * f
            ctx.drawImage(sheet, frame * FLAME.w, 0, FLAME.w, FLAME.h, fx, fy, fw, fh)
            ctx.globalAlpha = 1
          }
        }
        ctx.drawImage(bird, bx, by)

        // big day: sparkles over the flame
        if (s.bigDay && !s.ash) {
          if (Math.random() < 0.5) sparks.push({ x: W / 2 + (Math.random() - 0.5) * (bird.width + 30), y: GROUND - Math.random() * (bird.height + 40), life: 0, max: 8 + Math.random() * 8 })
          for (const k of sparks) {
            k.life++
            const on = k.life / k.max < 0.5 ? (k.life / k.max) * 2 : (1 - k.life / k.max) * 2
            ctx.globalAlpha = Math.min(1, on * 1.4)
            ctx.fillStyle = lv.light[4]
            ctx.fillRect(Math.round(k.x), Math.round(k.y), 1, 1)
            if (on > 0.55) {
              ctx.fillRect(Math.round(k.x) - 1, Math.round(k.y), 3, 1)
              ctx.fillRect(Math.round(k.x), Math.round(k.y) - 1, 1, 3)
            }
          }
          ctx.globalAlpha = 1
          for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life >= sparks[i].max) sparks.splice(i, 1)
        }
      }
      raf = requestAnimationFrame(draw)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={ref} width={W} height={H} className="roost" aria-label={`Your phoenix: ${LEVELS[p.level].name}${p.ash ? ', burned to ash' : ''}`} role="img" />
}
