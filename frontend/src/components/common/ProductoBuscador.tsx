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

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg self-start" style={{ background: 'var(--surface, #f5f5f5)', border: '1px solid var(--border, #e5e7eb)' }}>
        {(['producto', 'apu'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className="px-3 py-1 text-xs rounded-md font-medium transition-all"
            style={{
              background: mode === m ? '#c8f135' : 'transparent',
              color: mode === m ? '#111' : '#6b7280',
            }}
          >
            {m === 'producto' ? 'Producto' : 'Base APU'}
          </button>
        ))}
      </div>

      {/* Search row */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">🔍</span>
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
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {mode === 'producto' && (
          <button
            type="button"
            onClick={onCreateNew}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-blue-600 font-bold text-lg shadow-sm transition-colors"
            title="Crear nuevo producto"
          >+</button>
        )}

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div
            className="absolute z-50 top-full mt-1 left-0 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
            style={{ right: mode === 'producto' ? '2.75rem' : 0 }}
          >
            {mode === 'producto'
              ? (results as Producto[]).map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => selectProducto(p)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${i === activeIdx ? 'bg-blue-50' : ''} ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="w-8 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-mono flex-shrink-0 uppercase">
                    {p.codigo.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.unidad_medida} · IVA {p.impuesto_porcentaje ?? 0}%</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">{formatCurrency(p.precio_unitario)}</span>
                </button>
              ))
              : (results as APUItem[]).map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={() => selectAPU(a)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${i === activeIdx ? 'bg-blue-50' : ''} ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="w-8 h-7 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 uppercase" style={{ background: '#c8f135', color: '#111' }}>
                    {(a.codigo ?? '').slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.nombre}</p>
                    <p className="text-xs text-gray-400">{a.unidad_medida} · APU</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">{formatCurrency(Number(a.precio_unitario ?? 0))}</span>
                </button>
              ))
            }
          </div>
        )}

        {open && !loading && results.length === 0 && query.trim() && (
          <div
            className="absolute z-50 top-full mt-1 left-0 bg-white rounded-xl border border-gray-200 shadow-lg"
            style={{ right: mode === 'producto' ? '2.75rem' : 0 }}
          >
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-between">
              <span>No se encontraron {mode === 'producto' ? 'productos' : 'APUs'}.</span>
              {mode === 'producto' && (
                <button type="button" onClick={onCreateNew} className="text-blue-600 hover:underline font-medium text-xs">+ Crear nuevo</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
