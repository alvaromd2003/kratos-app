export const DIETARY_TAGS = [
  { value: 'sin_gluten', label: 'Sin gluten' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin_frutos_secos', label: 'Sin frutos secos' },
  { value: 'sin_lactosa', label: 'Sin lactosa' },
] as const

export type DietaryTag = (typeof DIETARY_TAGS)[number]['value']

export function dietaryTagLabel(tag: string): string {
  return DIETARY_TAGS.find((t) => t.value === tag)?.label ?? tag
}
