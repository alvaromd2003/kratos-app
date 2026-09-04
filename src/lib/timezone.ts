import 'server-only'

// The server (Vercel) runs in UTC, not the restaurant's local time, so
// naively doing `new Date().setHours(0,0,0,0)` gives UTC midnight — off by
// 1-2 hours from an actual Spanish midnight depending on DST. This finds
// the real start of "today" in a given IANA timezone instead.
//
// Hardcoded to Europe/Madrid for now — becomes a per-restaurant setting
// once international expansion is actually on the table.
export function startOfTodayIso(timeZone = 'Europe/Madrid'): string {
  const now = new Date()
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // "YYYY-MM-DD" in the target timezone

  const guessUtcMidnight = new Date(`${dateStr}T00:00:00Z`)
  const hourAtGuess = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false }).format(
      guessUtcMidnight
    )
  )
  const offsetHours = hourAtGuess === 24 ? 0 : hourAtGuess

  return new Date(guessUtcMidnight.getTime() - offsetHours * 3600 * 1000).toISOString()
}
