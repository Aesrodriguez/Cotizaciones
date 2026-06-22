interface Props {
  rows?: number
  cols?: number
}

export default function SkeletonTable({ rows = 6, cols = 4 }: Props) {
  return (
    <div className="w-full animate-pulse">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 rounded flex-1" style={{ background: 'var(--border)', maxWidth: i === 0 ? '80px' : undefined }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3 rounded flex-1"
              style={{
                background: 'var(--border)',
                opacity: 0.5 + (c % 2) * 0.3,
                maxWidth: c === 0 ? '80px' : c === cols - 1 ? '60px' : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
