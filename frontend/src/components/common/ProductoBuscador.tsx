import { useState, useRef, useCallback, useEffect } from 'react'
import { productosAPI } from '../../services/api'
import { formatCurrency } from '../../utils/format'
import type { Producto } from '../../types'

interface Props {
  onSelect: (producto: Producto) => void
  onCreateNew: () => void
  placeholder?: string
}

export default function ProductoBuscador({ onSelect, onCreateNew, placeholder = 'Buscar producto por código o nombre...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((term: string) => {
    clearTimeout(debounceRef.current)
    if (!term.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productosAPI.getAll({ search: term })
        setResults(res.data.slice(0, 8))
        setOpen(true)
        setActiveIdx(-1)
      } finally { setLoading(false) }
    }, 200)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    search(v)
  }

  const select = (p: Producto) => {
    onSelect(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(results[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="input pl-9"
          placeholder={placeholder}
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

      <button
        type="button"
        onClick={onCreateNew}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-blue-600 font-bold text-lg shadow-sm transition-colors"
        title="Crear nuevo producto"
      >+</button>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-9 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => select(p)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${i === activeIdx ? 'bg-blue-50' : ''} ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="w-8 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-mono flex-shrink-0 uppercase">
                {p.codigo.slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                <p className="text-xs text-gray-400">{p.unidad_medida} · IVA {p.impuesto_porcentaje ?? 0}%</p>
              </div>
              <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">
                {formatCurrency(p.precio_unitario)}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 top-full mt-1 left-0 right-9 bg-white rounded-xl border border-gray-200 shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-between">
            <span>No se encontraron productos.</span>
            <button type="button" onClick={onCreateNew} className="text-blue-600 hover:underline font-medium text-xs">
              + Crear nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
