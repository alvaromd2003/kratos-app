export const TABLE_ZONES = ['interior', 'terraza', 'barra'] as const

export type TableZone = (typeof TABLE_ZONES)[number]

export const TABLE_ZONE_LABELS: Record<TableZone, string> = {
  interior: 'Interior',
  terraza: 'Terraza',
  barra: 'Barra',
}
