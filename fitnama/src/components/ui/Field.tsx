import { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Field({ label, error, id, ...props }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={!!error}
        {...props}
        className={`px-3 py-2 rounded-lg outline-none transition-colors ${props.className ?? ''}`}
        style={{
          background: 'var(--bg)',
          border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
          color: 'var(--text)',
          ...props.style,
        }}
      />
      {error && (
        <p id={errorId} className="text-sm" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  )
}
