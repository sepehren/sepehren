import { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: boolean
}

export function Card({ children, padding = true, className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl ${padding ? 'p-6' : ''} ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        ...props.style,
      }}
    >
      {children}
    </div>
  )
}
