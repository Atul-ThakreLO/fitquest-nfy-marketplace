'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TokenInfo } from '@/types'

export function useOwnedNFTs(wallet: string | undefined) {
  return useQuery<TokenInfo[], Error>({
    queryKey: ['owned-nfts', wallet],
    queryFn: () => api.nft.getByOwner(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  })
}
