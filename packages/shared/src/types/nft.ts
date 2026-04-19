export enum Rarity {
  COMMON    = 0,
  RARE      = 1,
  EPIC      = 2,
  LEGENDARY = 3,
  MYTHIC    = 4,
}

export const RARITY_LABELS: Record<Rarity, string> = {
  [Rarity.COMMON]:    'Common',
  [Rarity.RARE]:      'Rare',
  [Rarity.EPIC]:      'Epic',
  [Rarity.LEGENDARY]: 'Legendary',
  [Rarity.MYTHIC]:    'Mythic',
}

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]:    '#9CA3AF',
  [Rarity.RARE]:      '#60A5FA',
  [Rarity.EPIC]:      '#A78BFA',
  [Rarity.LEGENDARY]: '#FCD34D',
  [Rarity.MYTHIC]:    '#F97316',
}

export interface NFTMetadata {
  name: string
  description: string
  image: string           // ipfs://Qm.../filename.png
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

export interface TokenInfo {
  tokenId: bigint
  rarity: Rarity
  ipfsCID: string
  firstListed: boolean
  owner: `0x${string}`
}

export interface Listing {
  tokenId: bigint,
  rarity: number,
  seller: `0x${string}`
  price: bigint           // in wei
  active: boolean
  createdAt: number       // unix timestamp
}
