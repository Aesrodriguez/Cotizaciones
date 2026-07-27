import { useState } from 'react'

interface MoneyInputProps {
  value: number | string
  onChange: (raw: string) => void   // raw digit string, e.g. "1500000"
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

/**
 * Input de dinero con separador de miles colombiano (.).
 * - Editing: muestra dígitos sin formato para edición libre
 * - Blurred: muestra valor formateado  (ej. 1.500.000)
 * - onChange recibe el string de dígitos puro, sin puntos
 */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  disabled = false,
  autoFocus = false,
  id,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false)

  const raw = String(value ?? '').replace(/[^0-9]/g, '')
  const num = raw ? Number(raw) : null

  const displayValue = focused
    ? raw
    : num != null ? new Intl.NumberFormat('es-CO').format(num) : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    onChange(digits)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={(e) => { setFocused(true); setTimeout(() => e.target.select(), 0) }}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  )
}
