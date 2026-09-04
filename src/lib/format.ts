export function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(
    priceCents / 100
  )
}
