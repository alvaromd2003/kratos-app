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

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

// Zero-padded to "HH:MM:SS" — matching from/until's exact format (see
// below) matters: a shorter "HH:MM" string compares as *less than* an
// otherwise-equal "HH:MM:SS" one in a plain string comparison, which
// made a window's exact start minute wrongly read as "not open yet" for
// a full 60 seconds every day.
export function currentTimeInZone(timeZone = 'Europe/Madrid'): string {
  return (
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()) + ':00'
  )
}

// from/until are "HH:MM:SS", straight from a Postgres `time` column —
// comparing as plain strings works since they're zero-padded and now is
// formatted to the same "HH:MM:SS" shape above. Handles a window that
// crosses midnight (e.g. 22:00–02:00).
export function isWithinTimeWindow(from: string, until: string, now: string): boolean {
  if (from <= until) return now >= from && now <= until
  return now >= from || now <= until
}
