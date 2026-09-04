'use client'

// Several independent widgets on the same page (e.g. Barra has both "help
// requests" and "ready orders") each report their own pending count under
// their own key; the tab title shows the sum, e.g. "(3) Barra". Keeps
// components decoupled — none of them needs to know about the others.
const counts = new Map<string, number>()
let baseTitle: string | null = null

function applyTitle() {
  if (baseTitle === null) {
    baseTitle = document.title
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  document.title = total > 0 ? `(${total}) ${baseTitle}` : baseTitle
}

export function setBadgeCount(key: string, count: number) {
  if (typeof document === 'undefined') return
  counts.set(key, count)
  applyTitle()
}

export function clearBadgeCount(key: string) {
  if (typeof document === 'undefined') return
  counts.delete(key)
  applyTitle()
}
