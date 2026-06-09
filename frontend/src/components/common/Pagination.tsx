interface Props {
  page: number
  pages: number
  total: number
  limit: number
  onChange: (page: number) => void
}

export default function Pagination({ page, pages, total, limit, onChange }: Props) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1} className="btn-secondary py-1 px-3 disabled:opacity-40">‹ Anterior</button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, pages - 4)) + i
          return (
            <button key={p} onClick={() => onChange(p)} className={`py-1 px-3 rounded-lg ${p === page ? 'bg-blue-600 text-white' : 'btn-secondary'}`}>{p}</button>
          )
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === pages} className="btn-secondary py-1 px-3 disabled:opacity-40">Siguiente ›</button>
      </div>
    </div>
  )
}
