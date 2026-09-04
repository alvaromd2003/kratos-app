'use client'

// Short tones synthesized on the fly — no audio file needed. Kitchen/bar
// staff have their hands busy and aren't staring at the screen, so a
// silent banner is easy to miss entirely.

function getAudioContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Ctor ? new Ctor() : null
}

function beep(ctx: AudioContext, startTime: number, freq: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.type = 'sine'
  oscillator.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25)
  oscillator.start(startTime)
  oscillator.stop(startTime + 0.3)
}

// Rising two-tone "ding-ding" — new order / new ready-to-serve / new help
// request: something to pick up and act on.
export function playAlertSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    beep(ctx, ctx.currentTime, 880)
    beep(ctx, ctx.currentTime + 0.15, 1108)
  } catch {
    // Sound is a nice-to-have, not critical — the visual alert still works
    // even if audio is blocked or unsupported.
  }
}

// Falling three-tone — a decision needed on something already in motion
// (right now: a diner's cancellation request). Deliberately different
// from playAlertSound() so staff can tell which situation it is by ear,
// without even looking at the screen first.
export function playWarningSound() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    beep(ctx, ctx.currentTime, 1108)
    beep(ctx, ctx.currentTime + 0.13, 880)
    beep(ctx, ctx.currentTime + 0.26, 660)
  } catch {
    // Same as above — non-critical.
  }
}
