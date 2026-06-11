import { useState, useEffect, useRef, useCallback } from 'react'
import { clientesAPI } from '../../services/api'
import type { Cliente } from '../../types'

interface Props {
  value: string
  displayName: string
  onChange: (id: string, nombre: string, email?: string) => void
  onCreateNew: () => void
  error?: boolean
}

export default function ClienteAutocomplete({ value, displayName, onChange, onCreateNew, error }: Props) {
  const [query, setQuery] = useState(displayName)
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(displayName) }, [displayName])

  const search = useCallback((term: string) => {
    clearTimeout(debounceRef.current)
    if (!term.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await clientesAPI.getAll({ search: term, limit: 10 })
        setResults(res.data.data)
        setOpen(true)
        setActiveIdx(-1)
      } finally { setLoading(false) }
    }, 300)
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (value) onChange('', '', undefined)
    search(v)
  }

  const select = (c: Cliente) => {
    setQuery(c.nombre)
    setResults([])
    setOpen(false)
    onChange(c.id, c.nombre, c.contacto_email ?? undefined)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onChange('', '', undefined)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(results[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const borderClass = error
    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
    : ''

  return (
    <div ref={containerRef} className="relative flex gap-2">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          className={`input pr-8 ${borderClass}`}
          placeholder="Buscar cliente por nombre..."
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs leading-none"
          >✕</button>
        )}
      </div>

      <button
        type="button"
        onClick={onCreateNew}
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-blue-50 text-blue-600 font-bold text-lg shadow-sm transition-colors"
        title="Crear nuevo cliente"
      >+</button>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-9 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => select(c)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${i === activeIdx ? 'bg-blue-50' : ''} ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                {c.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{c.nombre}</p>
                <p className="text-xs text-gray-400">{c.ciudad ?? c.contacto_email ?? c.codigo}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 top-full mt-1 left-0 right-9 bg-white rounded-xl border border-gray-200 shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500">
            Sin resultados.{' '}
            <button type="button" onClick={onCreateNew} className="text-blue-600 hover:underline font-medium">
              Crear nuevo cliente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
