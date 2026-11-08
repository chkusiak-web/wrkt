let ctx: AudioContext | null = null

/** Call from a tap so iOS allows audio later. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio */
  }
}

export function beep(times = 1, freq = 880) {
  try {
    ctx ??= new AudioContext()
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.25
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.start(t)
      o.stop(t + 0.2)
    }
  } catch {
    /* no audio */
  }
  navigator.vibrate?.(times > 1 ? [150, 80, 150] : 120)
}

let lock: { release: () => Promise<void> } | null = null
export async function keepAwake(on: boolean) {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (on && wl && !lock) lock = await wl.request('screen')
    if (!on && lock) {
      await lock.release()
      lock = null
    }
  } catch {
    /* not supported */
  }
}
