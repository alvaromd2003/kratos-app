'use client'

// A short two-tone "ping" synthesized on the fly — no audio file needed.
// Kitchen/bar staff have their hands busy and aren't staring at the
// screen, so a silent new-order banner is easy to miss entirely.
export function playAlertSound() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()

    const beep = (startTime: number, freq: number) => {
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

    beep(ctx.currentTime, 880)
    beep(ctx.currentTime + 0.15, 1108)
  } catch {
    // Sound is a nice-to-have, not critical — the visual alert still works
    // even if audio is blocked or unsupported.
  }
}
