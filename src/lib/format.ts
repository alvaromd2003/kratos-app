export function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(
    priceCents / 100
  )
}

// timeZone is pinned to Europe/Madrid rather than left to the runtime
// default: without it, the server (UTC on Vercel) and the browser
// (whatever the visitor's OS is set to) format the exact same instant
// differently, which React treats as a hydration mismatch — this was
// crashing /admin/floor and other pages with a real render error for any
// visitor not in the UTC timezone (i.e. every actual user in Spain).
export function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(isoDate))
}

export function formatDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(isoDate))
}
