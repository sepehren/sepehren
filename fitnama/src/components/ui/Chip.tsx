import { HTMLAttributes, ReactNode } from 'react'

type ChipVariant = 'default' | 'lime' | 'muted' | 'danger'

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: ChipVariant
}

const chipStyles: Record<ChipVariant, React.CSSProperties> = {
  default: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  lime: { background: 'rgba(212, 242, 70, 0.15)', color: 'var(--lime)', border: '1px solid rgba(212, 242, 70, 0.3)' },
  muted: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' },
  danger: { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' },
}

export function Chip({ children, variant = 'default', className = '', ...props }: ChipProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ ...chipStyles[variant], ...props.style }}
    >
      {children}
    </span>
  )
}
