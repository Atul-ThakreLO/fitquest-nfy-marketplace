import { Rarity, RARITY_LABELS } from 'territory-nft-shared'
import { RARITY_BG } from '@/constants/rarity'
import { cn } from '@/lib/utils'

interface RarityBadgeProps {
  rarity: Rarity
  size?: 'sm' | 'md'
  className?: string
}

export function RarityBadge({ rarity, size = 'md', className }: RarityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        RARITY_BG[rarity],
        className
      )}
    >
      {RARITY_LABELS[rarity]}
    </span>
  )
}
