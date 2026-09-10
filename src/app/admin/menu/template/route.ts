import { requireManagerRole } from '@/lib/restaurant'

const HEADER = [
  'nombre',
  'descripcion',
  'precio',
  'categoria',
  'estacion',
  'alergenos',
  'disponible_desde',
  'disponible_hasta',
]

const EXAMPLE_ROWS = [
  ['Tortilla de patatas', 'Con huevo, patata y cebolla', '9.50', 'Entrantes', 'cocina', 'sin_gluten,vegetariano', '', ''],
  ['Mojito', 'Ron, lima, menta y azúcar', '7.00', 'Bebidas', 'barra', '', '', ''],
]

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET() {
  await requireManagerRole()

  const rows = [HEADER, ...EXAMPLE_ROWS]
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const bom = String.fromCharCode(0xfeff)

  return new Response(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-menu-kratos.csv"',
    },
  })
}
