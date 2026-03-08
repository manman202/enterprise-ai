import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={['rounded-lg border border-gray-800 bg-gray-900 p-4', className].join(' ')}
      {...props}
    >
      {title && <h2 className="mb-3 text-sm font-semibold text-gray-200">{title}</h2>}
      {children}
    </div>
  )
}
