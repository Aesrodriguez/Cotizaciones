import { useEffect, useState, useCallback } from 'react'
import { apuAPI } from '../services/api'
import { formatCurrency } from '../utils/format'
import { useDebounce } from '../hooks/useDebounce'
import toast from 'react-hot-toast'
import type { APUItem, APUDetalle } from '../types'

interface Capitulo { codigo: string; nombre: string }

function fmt(v?: number | null) {
  return v == null ? '—' : formatCurrency(v)
}

// ── Precio editable ────────────────────────────────────────────────────────
function EditablePrice({ value, onSave, lg }: { value: number; onSave: (v: number) => Promise<void>; lg?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const n = parseFloat(val.replace(/[^0-9.]/g, ''))
    if (isNaN(n)) { setEditing(false); setVal(String(value)); return }
    setSaving(true)
    try { await onSave(n); setEditing(false) } finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:opacity-70 font-mono font-bold transition-opacity ${lg ? 'text-xl' : 'text-xs'}`}
        style={{ color: 'var(--lime)' }}
        onClick={(e) => { e.stopPropagation(); setVal(String(value)); setEditing(true) }}
        title="Click para editar precio"
      >
        {fmt(value)}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        className="input !py-0.5 !px-1.5 font-mono w-32"
        style={{ fontSize: lg ? '1rem' : '0.75rem' }}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
      />
      <button onClick={save} disabled={saving} className="btn-primary !py-0.5 !px-2 text-xs">
        {saving ? '…' : '✓'}
      </button>
    </span>
  )
}

// ── Tabla de detalle ───────────────────────────────────────────────────────
function DetalleTable({
  title, rows, updateFn, nameKey = 'descripcion',
}: {
  title: string
  rows: APUDetalle[]
  updateFn: (id: string, d: { precio_unitario: number }) => Promise<unknown>
  nameKey?: 'nombre' | 'descripcion'
}) {
  if (!rows.length) return null
  const total = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0)
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</span>
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--lime)' }}>{fmt(total)}</span>
      </div>
      <table className="w-full text-xs">
        <colgroup>
          <col style={{ width: '45%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Descripción', 'Und', 'Cant.', 'P. Unit.', 'Parcial'].map((h, i) => (
              <th key={h} className={`px-3 py-1.5 font-medium ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="px-3 py-2 leading-snug" style={{ color: 'var(--text)' }}>{r[nameKey] ?? r.descripcion ?? r.nombre}</td>
              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{r.unidad}</td>
              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                {r.cantidad != null ? Number(r.cantidad).toFixed(4) : '—'}
              </td>
              <td className="px-3 py-2 text-right">
                <EditablePrice
                  value={Number(r.precio_unitario ?? 0)}
                  onSave={async (v) => { await updateFn(r.id, { precio_unitario: v }); toast.success('Precio actualizado') }}
                />
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(Number(r.subtotal ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tarjeta APU expandible ─────────────────────────────────────────────────
function APUCard({ item, onPriceUpdated }: { item: APUItem; onPriceUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<APUItem | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const toggle = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true)
      try {
        const r = await apuAPI.getById(item.id)
        setDetail(r.data)
      } finally { setLoadingDetail(false) }
    }
    setExpanded((v) => !v)
  }

  const nMat = detail?.materiales?.length ?? 0
  const nEqu = detail?.equipos?.length ?? 0
  const nMob = detail?.mano_obra?.length ?? 0

  const totalMat = (detail?.materiales ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)
  const totalEqu = (detail?.equipos ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)
  const totalMob = (detail?.mano_obra ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)

  return (
    <div
      className="rounded-2xl overflow-hidden transition-shadow"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: expanded ? '0 4px 24px rgba(0,0,0,0.18)' : undefined,
      }}
    >
      {/* ── Cabecera ── */}
      <div className="p-5">
        {/* Fila 1: capítulo + código + unidad */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {item.capitulo_codigo && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cap. {item.capitulo_codigo}
              </span>
            )}
            <span className="text-sm font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'var(--lime)', color: '#111' }}>
              {item.codigo}
            </span>
          </div>
          <span className="text-xs font-mono font-semibold flex-shrink-0 px-2 py-1 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {item.unidad_medida}
          </span>
        </div>

        {/* Fila 2: nombre */}
        <p className="text-base font-semibold leading-snug mb-4" style={{ color: 'var(--text)' }}>
          {item.nombre}
        </p>

        {/* Fila 3: capítulo nombre */}
        {item.capitulo && (
          <p className="text-xs mb-4 leading-snug" style={{ color: 'var(--text-muted)' }}>
            {item.capitulo}
          </p>
        )}

        {/* Fila 4: precio + stats resumen */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Precio unitario</p>
            <EditablePrice
              lg
              value={Number(item.precio_unitario ?? 0)}
              onSave={async (v) => { await apuAPI.updatePrecio(item.id, v); toast.success('Precio actualizado'); onPriceUpdated() }}
            />
          </div>

          {/* Resumen de insumos (si ya se cargó el detalle) */}
          {detail ? (
            <div className="flex items-center gap-3 text-xs">
              {nMat > 0 && (
                <div className="text-right">
                  <div style={{ color: 'var(--text-muted)' }}>Materiales</div>
                  <div className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(totalMat)}</div>
                </div>
              )}
              {nEqu > 0 && (
                <div className="text-right">
                  <div style={{ color: 'var(--text-muted)' }}>Equipo</div>
                  <div className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(totalEqu)}</div>
                </div>
              )}
              {nMob > 0 && (
                <div className="text-right">
                  <div style={{ color: 'var(--text-muted)' }}>Mano de obra</div>
                  <div className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(totalMob)}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Botón expandir ── */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium transition-colors"
        style={{ borderTop: '1px solid var(--border)', color: expanded ? 'var(--lime)' : 'var(--text-muted)', background: 'var(--surface)' }}
      >
        <span>
          {loadingDetail
            ? 'Cargando detalle…'
            : expanded
              ? `Ocultar desglose · ${nMat + nEqu + nMob} insumos`
              : 'Ver desglose de insumos'}
        </span>
        <span className="transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>▼</span>
      </button>

      {/* ── Detalle expandido ── */}
      {expanded && detail && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {nMat + nEqu + nMob === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin detalle de insumos registrado.</p>
          ) : (
            <>
              {detail.materiales && detail.materiales.length > 0 && (
                <DetalleTable
                  title={`Materiales (${nMat})`}
                  rows={detail.materiales}
                  nameKey="nombre"
                  updateFn={(id, d) => apuAPI.updateMaterial(item.id, id, d)}
                />
              )}
              {detail.equipos && detail.equipos.length > 0 && (
                <DetalleTable
                  title={`Equipo y Herramientas (${nEqu})`}
                  rows={detail.equipos}
                  updateFn={(id, d) => apuAPI.updateEquipo(item.id, id, d)}
                />
              )}
              {detail.mano_obra && detail.mano_obra.length > 0 && (
                <DetalleTable
                  title={`Mano de Obra (${nMob})`}
                  rows={detail.mano_obra}
                  updateFn={(id, d) => apuAPI.updateManoObra(item.id, id, d)}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function APUPage() {
  const [capitulos, setCapitulos] = useState<Capitulo[]>([])
  const [selectedCap, setSelectedCap] = useState<string>('')
  const [items, setItems] = useState<APUItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const debouncedSearch = useDebounce(search, 350)
  const limit = 20

  const loadCapitulos = useCallback(() => {
    setLoadError(false)
    apuAPI.getCapitulos()
      .then((r) => { setCapitulos(r.data); if (r.data.length > 0) setSelectedCap(r.data[0].codigo) })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => { loadCapitulos() }, [loadCapitulos])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apuAPI.getAll({ capitulo: selectedCap, search: debouncedSearch, page, limit })
      setItems(r.data.data)
      setTotal(r.data.total)
    } catch { setItems([]); setTotal(0) }
    finally { setLoading(false) }
  }, [selectedCap, debouncedSearch, page])

  useEffect(() => { if (selectedCap) loadItems() }, [loadItems])
  useEffect(() => { setPage(1) }, [selectedCap, debouncedSearch])

  const totalPages = Math.ceil(total / limit) || 1
  const selectedCapName = capitulos.find((c) => c.codigo === selectedCap)?.nombre ?? ''

  return (
    <div className="flex h-[calc(100vh-80px)]" style={{ overflow: 'hidden' }}>

      {/* ── Sidebar capítulos ─────────────────────────────────────────── */}
      <div
        className="w-56 flex-shrink-0 flex flex-col overflow-hidden"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Capítulos</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {capitulos.map((c) => (
            <button
              key={c.codigo}
              onClick={() => setSelectedCap(c.codigo)}
              className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2.5 transition-colors"
              style={{
                background: selectedCap === c.codigo ? 'color-mix(in srgb, var(--lime) 15%, transparent)' : 'transparent',
                color: selectedCap === c.codigo ? 'var(--lime)' : 'var(--text)',
                borderLeft: selectedCap === c.codigo ? '3px solid var(--lime)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="font-mono font-bold opacity-60 w-4 flex-shrink-0 text-right">{c.codigo}</span>
              <span className="leading-tight">{c.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido principal ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Barra superior */}
        <div className="px-5 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{selectedCapName || 'Base APU'}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {total > 0 ? `${total.toLocaleString()} actividades · Master Pack Colombia 2026` : 'Master Pack Colombia 2026'}
            </p>
          </div>
          <input
            type="search"
            placeholder="Buscar actividad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-sm w-56"
          />
        </div>

        {/* Tarjetas */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadError && (
            <div className="text-center py-20">
              <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>No se pudo cargar</p>
              <button onClick={loadCapitulos} className="btn-primary mt-2">Reintentar</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse h-48" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : items.length === 0 && !loadError ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay actividades en este capítulo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {items.map((item) => (
                <APUCard key={item.id} item={item} onPriceUpdated={loadItems} />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">← Anterior</button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Página {page} de {totalPages} · {total} actividades</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">Siguiente →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
