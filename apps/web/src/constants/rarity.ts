import { Rarity } from 'territory-nft-shared'

export const RARITY_BG: Record<Rarity, string> = {
  [Rarity.COMMON]:    'bg-gray-500/15 text-gray-300 ring-1 ring-gray-500/30',
  [Rarity.RARE]:      'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30',
  [Rarity.EPIC]:      'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30',
  [Rarity.LEGENDARY]: 'bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/30',
  [Rarity.MYTHIC]:    'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30 font-semibold',
}

export const RARITY_GLOW: Record<Rarity, string> = {
  [Rarity.COMMON]:    '',
  [Rarity.RARE]:      'shadow-blue-500/20',
  [Rarity.EPIC]:      'shadow-purple-500/25',
  [Rarity.LEGENDARY]: 'shadow-yellow-500/30',
  [Rarity.MYTHIC]:    'shadow-orange-500/40',
}
