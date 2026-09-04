'use client'

import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

// Keeps the screen on while this page is open — a kitchen/bar tablet that
// locks itself mid-shift means the sound/visual alerts go unnoticed until
// someone manually wakes it up. Fails silently on browsers that don't
// support the API (mainly older Safari).
export function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        const nav = navigator as NavigatorWithWakeLock
        if (!nav.wakeLock) return
        const lock = await nav.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        sentinel = lock
      } catch {
        // Not supported, or the browser refused (e.g. tab not visible) —
        // the visibilitychange listener below will retry when it can.
      }
    }

    function handleVisibilityChange() {
      // Wake locks are released automatically when the tab goes to the
      // background, so re-request it once it's visible again.
      if (document.visibilityState === 'visible' && !sentinel) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinel?.release().catch(() => {})
    }
  }, [])
}
