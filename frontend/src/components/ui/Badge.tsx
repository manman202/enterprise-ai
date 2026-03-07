type Variant = 'ok' | 'error' | 'warning' | 'neutral'

const variantClasses: Record<Variant, string> = {
  ok: 'bg-green-900/50 text-green-400 ring-green-500/30',
  error: 'bg-red-900/50 text-red-400 ring-red-500/30',
  warning: 'bg-yellow-900/50 text-yellow-400 ring-yellow-500/30',
  neutral: 'bg-gray-800 text-gray-400 ring-gray-600/30',
}

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
