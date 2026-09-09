export const TABLE_SHAPES = ['round', 'square'] as const

export type TableShape = (typeof TABLE_SHAPES)[number]

export const TABLE_SHAPE_LABELS: Record<TableShape, string> = {
  round: 'Redonda',
  square: 'Cuadrada',
}
