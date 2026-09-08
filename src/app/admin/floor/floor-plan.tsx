'use client'

import { useRef, useState } from 'react'
import { TableRowContent, type FloorTable } from './table-row-content'

// Tables that have never been dragged onto the plan (pos_x/pos_y still
// null — true for every table right after the feature ships) get a
// display-only grid position so the canvas is never empty. Nothing is
// saved until the owner actually drags a table, at which point its real
// position takes over.
function fallbackPosition(index: number): { x: number; y: number } {
  const cols = 4
  const col = index % cols
  const row = Math.floor(index / cols)
  return { x: 14 + col * 24, y: 18 + row * 24 }
}

export function FloorPlan({
  tables,
  currency,
  now,
  menuItems,
  expandedTableId,
  onToggleAssisted,
  onPositionChange,
}: {
  tables: FloorTable[]
  currency: string
  now: number | null
  menuItems: { id: string; name: string; price_cents: number }[]
  expandedTableId: string | null
  onToggleAssisted: (id: string | null) => void
  onPositionChange: (id: string, x: number, y: number) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const fallbackIndexById = new Map(
    tables
      .filter((t) => t.posX === null || t.posY === null)
      .map((t, index) => [t.id, index])
  )
  const positioned = tables.map((table) => {
    if (table.posX !== null && table.posY !== null) {
      return { table, x: table.posX, y: table.posY }
    }
    const pos = fallbackPosition(fallbackIndexById.get(table.id) ?? 0)
    return { table, x: pos.x, y: pos.y }
  })

  function clientToPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 50, y: 50 }
    const x = Math.min(96, Math.max(4, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(92, Math.max(8, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, tableId: string) {
    if (!editMode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(tableId)
    setDragPos(clientToPercent(e.clientX, e.clientY))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingId) return
    setDragPos(clientToPercent(e.clientX, e.clientY))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingId) return
    const pos = clientToPercent(e.clientX, e.clientY)
    onPositionChange(draggingId, pos.x, pos.y)
    setDraggingId(null)
    setDragPos(null)
  }

  const selectedTable = tables.find((t) => t.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          setEditMode((current) => !current)
          setSelectedId(null)
        }}
        className={`self-start rounded-lg px-3 py-1.5 text-xs font-medium ${
          editMode ? 'bg-ember text-ink' : 'border border-marble-3 text-bronze'
        }`}
      >
        {editMode ? 'Terminar de editar' : 'Editar plano (arrastrar mesas)'}
      </button>

      <div
        ref={canvasRef}
        className="relative h-80 rounded-xl border border-marble-3 bg-white sm:h-96"
        style={{
          backgroundImage: 'radial-gradient(circle, #E1E5E9 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {positioned.map(({ table, x, y }) => {
          const isDragging = draggingId === table.id
          const displayX = isDragging && dragPos ? dragPos.x : x
          const displayY = isDragging && dragPos ? dragPos.y : y
          return (
            <button
              key={table.id}
              type="button"
              onPointerDown={(e) => handlePointerDown(e, table.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={() => {
                if (editMode) return
                setSelectedId((current) => (current === table.id ? null : table.id))
              }}
              className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-transform ${
                table.occupied ? 'bg-rust' : 'bg-sage'
              } ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                selectedId === table.id ? 'ring-4 ring-ember' : ''
              } ${isDragging ? 'scale-110 shadow-lg' : ''}`}
              style={{ left: `${displayX}%`, top: `${displayY}%`, touchAction: 'none' }}
            >
              {table.label}
            </button>
          )
        })}
      </div>

      {editMode && (
        <p className="text-xs text-bronze">
          Arrastra cada mesa a su sitio en la sala. Se guarda sola al soltarla.
        </p>
      )}

      {!editMode && selectedTable && (
        <div className="flex flex-col gap-2 rounded-xl border border-marble-3 bg-white p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-bronze">Mesa seleccionada</span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs text-bronze underline"
            >
              Cerrar panel
            </button>
          </div>
          <TableRowContent
            table={selectedTable}
            currency={currency}
            now={now}
            menuItems={menuItems}
            expanded={expandedTableId === selectedTable.id}
            onToggleAssisted={() =>
              onToggleAssisted(expandedTableId === selectedTable.id ? null : selectedTable.id)
            }
          />
        </div>
      )}
    </div>
  )
}
