import { useState, useRef, useCallback, useEffect } from 'react'
import { productosAPI, apuAPI } from '../../services/api'
import { formatCurrency } from '../../utils/format'
import type { APUItem, Producto } from '../../types'

export interface SelectedItem {
  id: string | null
  nombre: string
  precio_unitario: number
  unidad_medida: string
  impuesto_porcentaje: number
  source: 'producto' | 'apu'
}

interface Props {
  onSelect: (item: SelectedItem) => void
  onCreateNew: () => void
  placeholder?: string
}

// Row hover handled via inline onMouseEnter/Leave to avoid Tailwind class conflicts in dark mode
function ResultRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const highlighted = active || hovered
  return (
    <button
      type="button"
      onMouseDown={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
      style={{
        background: highlighted ? 'color-mix(in srgb, var(--lime) 12%, var(--card))' : 'var(--card)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  )
}

export default function ProductoBuscador({ onSelect, onCreateNew, placeholder }: Props) {
  const [mode, setMode] = useState<'producto' | 'apu'>('producto')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<(Producto | APUItem)[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((term: string, currentMode: 'producto' | 'apu') => {
    clearTimeout(debounceRef.current)
    if (!term.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        if (currentMode === 'producto') {
          const res = await productosAPI.getAll({ search: term })
          setResults((res.data as unknown as Producto[]).slice(0, 8))
        } else {
          const res = await apuAPI.getAll({ search: term, limit: 8 })
          setResults(res.data.data.slice(0, 8))
        }
        setOpen(true)
        setActiveIdx(-1)
      } finally { setLoading(false) }
    }, 200)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    search(v, mode)
  }

  const switchMode = (m: 'producto' | 'apu') => {
    setMode(m)
    setQuery('')
    setResults([])
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const selectProducto = (p: Producto) => {
    onSelect({ id: p.id, nombre: p.nombre, precio_unitario: Number(p.precio_unitario), unidad_medida: p.unidad_medida, impuesto_porcentaje: Number(p.impuesto_porcentaje ?? 0), source: 'producto' })
    setQuery(''); setResults([]); setOpen(false)
  }

  const selectAPU = (a: APUItem) => {
    onSelect({ id: null, nombre: `${a.codigo} — ${a.nombre}`, precio_unitario: Number(a.precio_unitario ?? 0), unidad_medida: a.unidad_medida, impuesto_porcentaje: 0, source: 'apu' })
    setQuery(''); setResults([]); setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      if (mode === 'producto') selectProducto(results[activeIdx] as Producto)
      else selectAPU(results[activeIdx] as APUItem)
    }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const ph = placeholder ?? (mode === 'producto' ? 'Buscar producto por código o nombre...' : 'Buscar APU por código o nombre...')

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    top: 'calc(100% + 4px)',
    left: 0,
    right: mode === 'producto' ? '2.75rem' : 0,
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    overflow: 'hidden',
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {/* Mode tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg self-start"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {(['producto', 'apu'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className="px-3 py-1 text-xs rounded-md font-medium transition-all"
            style={{
              background: mode === m ? 'var(--lime)' : 'transparent',
              color: mode === m ? '#111' : 'var(--text-muted)',
            }}
          >
            {m === 'producto' ? 'Producto' : 'Base APU'}
          </button>
        ))}
      </div>

      {/* Search row */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="input pl-9"
            placeholder={ph}
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--lime)', borderTopColor: 'transparent' }} />
            </div>
          )}
        </div>

        {mode === 'producto' && (
          <button
            type="button"
            onClick={onCreateNew}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--lime)' }}
            title="Crear nuevo producto"
          >+</button>
        )}

        {/* Dropdown — results */}
        {open && results.length > 0 && (
          <div style={{ ...dropdownStyle, maxHeight: '320px', overflowY: 'auto' }}>
            {mode === 'producto'
              ? (results as Producto[]).map((p, i) => (
                <ResultRow key={p.id} active={i === activeIdx} onClick={() => selectProducto(p)}>
                  <div
                    className="w-8 h-7 rounded flex items-center justify-center text-xs font-mono flex-shrink-0 uppercase"
                    style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {p.codigo.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.unidad_medida} · IVA {p.impuesto_porcentaje ?? 0}%</p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0 ml-2" style={{ color: 'var(--lime)' }}>{formatCurrency(p.precio_unitario)}</span>
                </ResultRow>
              ))
              : (results as APUItem[]).map((a, i) => (
                <ResultRow key={a.id} active={i === activeIdx} onClick={() => selectAPU(a)}>
                  <div
                    className="w-8 h-7 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 uppercase"
                    style={{ background: 'var(--lime)', color: '#111' }}
                  >
                    {(a.codigo ?? '').slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.unidad_medida} · APU</p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0 ml-2" style={{ color: 'var(--lime)' }}>{formatCurrency(Number(a.precio_unitario ?? 0))}</span>
                </ResultRow>
              ))
            }
          </div>
        )}

        {/* Dropdown — empty state */}
        {open && !loading && results.length === 0 && query.trim() && (
          <div style={dropdownStyle}>
            <div className="px-4 py-3 text-sm flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
              <span>No se encontraron {mode === 'producto' ? 'productos' : 'APUs'}.</span>
              {mode === 'producto' && (
                <button type="button" onClick={onCreateNew} className="text-xs font-medium hover:underline" style={{ color: 'var(--lime)' }}>
                  + Crear nuevo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
