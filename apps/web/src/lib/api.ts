import type { TokenInfo, Listing, Auction, Bid } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface SaleEvent {
  tokenId: bigint
  seller: `0x${string}`
  buyer: `0x${string}`
  price: bigint
  timestamp: number
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message ?? 'API error')
  return json.data as T
}

export const api = {
  nft: {
    getByTokenId: (tokenId: string) =>
      apiFetch<TokenInfo>(`/nft/${tokenId}`),
    getByOwner: (wallet: string) =>
      apiFetch<TokenInfo[]>(`/nft/owner/${wallet}`),
    getAll: (skip = 0, take = 20, rarity?: number) =>
      apiFetch<TokenInfo[]>(`/nft?skip=${skip}&take=${take}${rarity !== undefined ? `&rarity=${rarity}` : ''}`),
  },
  marketplace: {
    getListings: (skip = 0, take = 20, rarity?: number, sort?: string) =>
      apiFetch<Listing[]>(
        `/marketplace/listings?skip=${skip}&take=${take}${rarity !== undefined ? `&rarity=${rarity}` : ''}${sort ? `&sort=${sort}` : ''}`
      ),
    getListing: (tokenId: string) =>
      apiFetch<Listing>(`/marketplace/listings/${tokenId}`),
    getHistory: (tokenId: string) =>
      apiFetch<SaleEvent[]>(`/marketplace/history/${tokenId}`),
  },
  auction: {
    getActive: () => apiFetch<Auction[]>('/auction/active'),
    getById: (id: string) => apiFetch<Auction>(`/auction/${id}`),
    getBids: (id: string) => apiFetch<Bid[]>(`/auction/${id}/bids`),
  },

}
