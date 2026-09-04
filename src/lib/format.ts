export function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(
    priceCents / 100
  )
}

export function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(isoDate)
  )
}

export function formatDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}
