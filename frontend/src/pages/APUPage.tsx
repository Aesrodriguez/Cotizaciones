import { useEffect, useState, useCallback, useRef } from 'react'
import { apuAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { formatCurrency } from '../utils/format'
import { useDebounce } from '../hooks/useDebounce'
import SkeletonTable from '../components/common/SkeletonTable'
import toast from 'react-hot-toast'
import type { APUItem, APUDetalle } from '../types'

interface Capitulo { codigo: string; nombre: string }

function fmt(v?: number | null) {
  if (v == null) return '—'
  return formatCurrency(v)
}

function EditablePrice({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const n = parseFloat(val.replace(/[^0-9.]/g, ''))
    if (isNaN(n)) { setEditing(false); setVal(String(value)); return }
    setSaving(true)
    try {
      await onSave(n)
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline font-mono text-xs"
        style={{ color: 'var(--lime)' }}
        onClick={() => { setVal(String(value)); setEditing(true) }}
        title="Click para editar"
      >
        {fmt(value)}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <input
        autoFocus
        className="input !py-0.5 !px-1.5 text-xs font-mono w-28"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false) } }}
      />
      <button
        onClick={save}
        disabled={saving}
        className="btn-primary !py-0.5 !px-2 text-xs"
      >{saving ? '…' : '✓'}</button>
    </span>
  )
}

function APUDetail({ apu, onPriceUpdated }: { apu: APUItem; onPriceUpdated: () => void }) {
  const hasContent =
    (apu.materiales?.length ?? 0) + (apu.mano_obra?.length ?? 0) + (apu.equipos?.length ?? 0) > 0

  if (!hasContent) {
    return <p className="text-xs px-2 py-2" style={{ color: 'var(--text-muted)' }}>Sin detalle de insumos.</p>
  }

  const section = (
    title: string,
    rows: APUDetalle[] | undefined,
    updateFn: (detId: string, data: { precio_unitario: number }) => Promise<unknown>,
    nameKey: 'nombre' | 'descripcion' = 'descripcion',
  ) => {
    if (!rows?.length) return null
    return (
      <div className="mb-2">
        <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}>
          {title}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Descripción', 'Und', 'Cant/Rend', 'Precio Unit.', 'Parcial'].map((h) => (
                <th key={h} className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-3 py-1.5" style={{ color: 'var(--text)' }}>{r[nameKey] ?? r.descripcion ?? r.nombre}</td>
                <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>{r.unidad}</td>
                <td className="px-3 py-1.5 font-mono text-right" style={{ color: 'var(--text-muted)' }}>
                  {r.cantidad != null ? Number(r.cantidad).toFixed(4) : '—'}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <EditablePrice
                    value={Number(r.precio_unitario ?? 0)}
                    onSave={async (v) => {
                      await updateFn(r.id, { precio_unitario: v })
                      toast.success('Precio actualizado')
                      onPriceUpdated()
                    }}
                  />
                </td>
                <td className="px-3 py-1.5 font-mono text-right" style={{ color: 'var(--text)' }}>
                  {fmt(Number(r.subtotal ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {section('Materiales', apu.materiales, (detId, data) => apuAPI.updateMaterial(apu.id, detId, data), 'nombre')}
      {section('Equipo y Herramientas', apu.equipos, (detId, data) => apuAPI.updateEquipo(apu.id, detId, data))}
      {section('Mano de Obra', apu.mano_obra, (detId, data) => apuAPI.updateManoObra(apu.id, detId, data))}
    </div>
  )
}

export default function APUPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.roles?.some((r) => r.nombre === 'ADMIN' || r.nombre === 'ADMINISTRADOR') ?? false

  const [capitulos, setCapitulos] = useState<Capitulo[]>([])
  const [selectedCap, setSelectedCap] = useState<string>('')
  const [items, setItems] = useState<APUItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<APUItem | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [seedRunning, setSeedRunning] = useState(false)
  const [seedCount, setSeedCount] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debouncedSearch = useDebounce(search, 350)
  const limit = 50

  const checkSeedStatus = useCallback(() => {
    apuAPI.seedStatus().then((r) => {
      setSeedRunning(r.data.running)
      setSeedCount(r.data.count)
      if (!r.data.running && r.data.count > 0 && capitulos.length === 0) {
        // Seed finished — reload capitulos
        apuAPI.getCapitulos().then((rc) => {
          setCapitulos(rc.data)
          if (rc.data.length > 0) setSelectedCap(rc.data[0].codigo)
        })
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
    }).catch(() => {})
  }, [capitulos.length])

  const loadCapitulos = useCallback(() => {
    setLoadError(false)
    apuAPI.getCapitulos()
      .then((r) => {
        setCapitulos(r.data)
        if (r.data.length > 0) setSelectedCap(r.data[0].codigo)
      })
      .catch(() => setLoadError(true))
  }, [])

  useEffect(() => { loadCapitulos() }, [loadCapitulos])

  // Start polling when seed is running
  useEffect(() => {
    if (seedRunning && !pollRef.current) {
      pollRef.current = setInterval(checkSeedStatus, 3000)
    }
    return () => {
      if (pollRef.current && !seedRunning) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [seedRunning, checkSeedStatus])

  const triggerSeed = async () => {
    try {
      const r = await apuAPI.seed()
      if (r.data.ok) {
        toast.success('Siembra iniciada — esto puede tardar 1-2 minutos')
        setSeedRunning(true)
        pollRef.current = setInterval(checkSeedStatus, 3000)
      } else {
        toast(r.data.msg)
        checkSeedStatus()
      }
    } catch {
      toast.error('Error al iniciar la siembra')
    }
  }

  const loadItems = useCallback(async () => {
    setLoading(true)
    setExpandedId(null)
    setExpandedData(null)
    try {
      const r = await apuAPI.getAll({ capitulo: selectedCap, search: debouncedSearch, page, limit })
      setItems(r.data.data)
      setTotal(r.data.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally { setLoading(false) }
  }, [selectedCap, debouncedSearch, page])

  useEffect(() => { if (selectedCap) loadItems() }, [loadItems])

  useEffect(() => { setPage(1) }, [selectedCap, debouncedSearch])

  const toggleExpand = async (item: APUItem) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      setExpandedData(null)
      return
    }
    setExpandedId(item.id)
    setExpandedData(null)
    setLoadingDetail(true)
    try {
      const r = await apuAPI.getById(item.id)
      setExpandedData(r.data)
    } finally { setLoadingDetail(false) }
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1>Base de Datos APU</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Master Pack Colombia 2026
            {seedCount > 0 && ` · ${seedCount.toLocaleString()} APUs cargados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {seedRunning && (
            <span className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--lime)' }}>
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--lime)' }} />
              Cargando datos APU…
            </span>
          )}
          {isAdmin && !seedRunning && seedCount === 0 && (
            <button onClick={triggerSeed} className="btn-primary text-sm">
              Cargar Base APU
            </button>
          )}
          {isAdmin && !seedRunning && seedCount > 0 && (
            <button onClick={triggerSeed} className="btn-secondary text-xs">
              Re-cargar datos
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="card text-center py-16">
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>No se pudo conectar</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            El servidor puede estar iniciando (frío). Espera 30 segundos y reintenta.
          </p>
          <button onClick={loadCapitulos} className="btn-primary">
            Reintentar
          </button>
        </div>
      )}

      {capitulos.length === 0 && !seedRunning && !loadError && (
        <div className="card text-center py-16">
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>Base APU vacía</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Los datos del Master Pack 2026 aún no están en la base de datos.
            {isAdmin ? ' Haz clic en "Cargar Base APU" para sembrarlos.' : ' Contacta al administrador.'}
          </p>
          {isAdmin && (
            <button onClick={triggerSeed} className="btn-primary">
              Cargar Base APU (2113 actividades)
            </button>
          )}
        </div>
      )}

      {seedRunning && capitulos.length === 0 && (
        <div className="card text-center py-16">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4" style={{ borderColor: 'var(--lime)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Cargando 2113 actividades APU… puede tardar 1-2 minutos
          </p>
        </div>
      )}

      <div className={`flex gap-4 items-start ${capitulos.length === 0 ? 'hidden' : ''}`}>
        {/* ── Chapter sidebar ─────────────────────────────── */}
        <div
          className="w-64 flex-shrink-0 rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            Capítulos
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {capitulos.map((c) => (
              <button
                key={c.codigo}
                onClick={() => setSelectedCap(c.codigo)}
                className="w-full text-left px-3 py-2.5 text-xs flex items-start gap-2 transition-colors"
                style={{
                  background: selectedCap === c.codigo ? 'var(--lime)' : 'transparent',
                  color: selectedCap === c.codigo ? '#111' : 'var(--text)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="font-mono font-bold opacity-60 w-5 flex-shrink-0">{c.codigo}</span>
                <span className="leading-tight">{c.nombre}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── APU table ────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="card !p-0 overflow-hidden">
            <div className="p-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                type="search"
                placeholder="Buscar actividad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input max-w-xs text-sm"
              />
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                {items.length} de {total.toLocaleString()}
              </span>
            </div>

            {loading ? (
              <SkeletonTable rows={10} cols={4} />
            ) : (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      {['Código', 'Actividad', 'Und', 'VR Unitario', ''].map((h, i) => (
                        <th key={i} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <>
                        <tr
                          key={item.id}
                          style={{ borderBottom: expandedId === item.id ? 'none' : '1px solid var(--border)', background: expandedId === item.id ? 'var(--surface)' : '' }}
                          className="cursor-pointer"
                          onClick={() => toggleExpand(item)}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: 'var(--lime)' }}>{item.codigo}</td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>{item.nombre}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{item.unidad_medida}</td>
                          <td className="px-4 py-2.5 text-right">
                            <EditablePrice
                              value={Number(item.precio_unitario ?? 0)}
                              onSave={async (v) => {
                                await apuAPI.updatePrecio(item.id, v)
                                toast.success('Precio actualizado')
                                loadItems()
                              }}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                            {expandedId === item.id ? '▲' : '▼'}
                          </td>
                        </tr>
                        {expandedId === item.id && (
                          <tr key={`${item.id}-detail`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={5} className="px-0 py-0">
                              {loadingDetail ? (
                                <p className="text-xs px-4 py-3" style={{ color: 'var(--text-muted)' }}>Cargando detalle…</p>
                              ) : expandedData ? (
                                <APUDetail
                                  apu={expandedData}
                                  onPriceUpdated={() => {
                                    apuAPI.getById(item.id).then((r) => setExpandedData(r.data))
                                  }}
                                />
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
                          No hay actividades en este capítulo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                    >← Anterior</button>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Página {page} de {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                    >Siguiente →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
