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
function EditablePrice({ value, onSave, size = 'md' }: { value: number; onSave: (v: number) => Promise<void>; size?: 'sm' | 'md' }) {
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
        className={`cursor-pointer hover:opacity-70 font-mono font-bold transition-opacity ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
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
        className="input !py-0.5 !px-1.5 text-xs font-mono w-28"
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

// ── Modal de detalle ───────────────────────────────────────────────────────
function APUModal({ apu, onClose, onUpdated }: { apu: APUItem; onClose: () => void; onUpdated: () => void }) {
  const detailSection = (
    title: string,
    rows: APUDetalle[] | undefined,
    updateFn: (detId: string, data: { precio_unitario: number }) => Promise<unknown>,
    nameKey: 'nombre' | 'descripcion' = 'descripcion',
  ) => {
    if (!rows?.length) return null
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest px-2" style={{ color: 'var(--text-muted)' }}>{title}</span>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Descripción', 'Und', 'Cant.', 'Precio Unit.', 'Parcial'].map((h, i) => (
                <th key={h} className={`py-1.5 text-xs font-medium ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 pr-3" style={{ color: 'var(--text)' }}>{r[nameKey] ?? r.descripcion ?? r.nombre}</td>
                <td className="py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{r.unidad}</td>
                <td className="py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                  {r.cantidad != null ? Number(r.cantidad).toFixed(4) : '—'}
                </td>
                <td className="py-2 text-right">
                  <EditablePrice
                    size="sm"
                    value={Number(r.precio_unitario ?? 0)}
                    onSave={async (v) => { await updateFn(r.id, { precio_unitario: v }); toast.success('Precio actualizado'); onUpdated() }}
                  />
                </td>
                <td className="py-2 text-right font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(Number(r.subtotal ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: 'var(--lime)', color: '#111' }}>
                {apu.codigo}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{apu.capitulo}</span>
            </div>
            <h2 className="text-base font-semibold leading-snug" style={{ color: 'var(--text)' }}>{apu.nombre}</h2>
          </div>
          <button onClick={onClose} className="text-xl leading-none flex-shrink-0 mt-1 opacity-50 hover:opacity-100" style={{ color: 'var(--text)' }}>✕</button>
        </div>

        {/* Precio + unidad */}
        <div className="px-6 py-3 flex items-center gap-6" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Unidad</div>
            <div className="font-mono font-semibold text-sm" style={{ color: 'var(--text)' }}>{apu.unidad_medida}</div>
          </div>
          <div>
            <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Precio unitario</div>
            <EditablePrice
              value={Number(apu.precio_unitario ?? 0)}
              onSave={async (v) => { await apuAPI.updatePrecio(apu.id, v); toast.success('Precio actualizado'); onUpdated() }}
            />
          </div>
        </div>

        {/* Detalle */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {(apu.materiales?.length ?? 0) + (apu.mano_obra?.length ?? 0) + (apu.equipos?.length ?? 0) === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin detalle de insumos registrado.</p>
          ) : (
            <>
              {detailSection('Materiales', apu.materiales, (id, d) => apuAPI.updateMaterial(apu.id, id, d), 'nombre')}
              {detailSection('Equipo y Herramientas', apu.equipos, (id, d) => apuAPI.updateEquipo(apu.id, id, d))}
              {detailSection('Mano de Obra', apu.mano_obra, (id, d) => apuAPI.updateManoObra(apu.id, id, d))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta APU ────────────────────────────────────────────────────────────
function APUCard({ item, onOpen, onPriceUpdated }: { item: APUItem; onOpen: () => void; onPriceUpdated: () => void }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-all hover:scale-[1.01]"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: 'var(--surface)', color: 'var(--lime)', border: '1px solid var(--border)' }}
        >
          {item.codigo}
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{item.unidad_medida}</span>
      </div>

      <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--text)' }}>
        {item.nombre}
      </p>

      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <EditablePrice
          value={Number(item.precio_unitario ?? 0)}
          onSave={async (v) => { await apuAPI.updatePrecio(item.id, v); toast.success('Precio actualizado'); onPriceUpdated() }}
        />
        <button
          className="text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
        >
          Ver detalle
        </button>
      </div>
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
  const [modalItem, setModalItem] = useState<APUItem | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const debouncedSearch = useDebounce(search, 350)
  const limit = 50

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

  const openModal = async (item: APUItem) => {
    setModalItem(item)
    setLoadingModal(true)
    try {
      const r = await apuAPI.getById(item.id)
      setModalItem(r.data)
    } finally { setLoadingModal(false) }
  }

  const totalPages = Math.ceil(total / limit) || 1
  const selectedCapName = capitulos.find((c) => c.codigo === selectedCap)?.nombre ?? ''

  return (
    <div className="flex gap-0 h-[calc(100vh-80px)]" style={{ overflow: 'hidden' }}>

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

        {/* Grid de tarjetas */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadError && (
            <div className="text-center py-20">
              <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>No se pudo cargar</p>
              <button onClick={loadCapitulos} className="btn-primary mt-2">Reintentar</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl p-4 animate-pulse h-32" style={{ background: 'var(--card)', border: '1px solid var(--border)' }} />
              ))}
            </div>
          ) : items.length === 0 && !loadError ? (
            <div className="text-center py-20">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay actividades en este capítulo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {items.map((item) => (
                <APUCard
                  key={item.id}
                  item={item}
                  onOpen={() => openModal(item)}
                  onPriceUpdated={loadItems}
                />
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">← Anterior</button>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Página {page} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1 px-4 disabled:opacity-40">Siguiente →</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal detalle ─────────────────────────────────────────────── */}
      {modalItem && (
        loadingModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--lime)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <APUModal
            apu={modalItem}
            onClose={() => setModalItem(null)}
            onUpdated={async () => {
              const r = await apuAPI.getById(modalItem.id)
              setModalItem(r.data)
              loadItems()
            }}
          />
        )
      )}
    </div>
  )
}
