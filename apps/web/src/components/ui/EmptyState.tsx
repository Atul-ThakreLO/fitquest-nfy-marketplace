import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: string
  className?: string
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Check back soon.',
  icon = '🏔️',
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 text-center', className)}>
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 max-w-xs text-sm">{description}</p>
    </div>
  )
}
