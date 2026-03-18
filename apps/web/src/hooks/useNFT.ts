'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TokenInfo } from '@/types'

export function useNFT(tokenId: string | undefined) {
  return useQuery<TokenInfo, Error>({
    queryKey: ['nft', tokenId],
    queryFn: () => api.nft.getByTokenId(tokenId!),
    enabled: !!tokenId,
    staleTime: 30_000,
  })
}

export function useNFTsByOwner(wallet: string | undefined) {
  return useQuery<TokenInfo[], Error>({
    queryKey: ['nfts', 'owner', wallet],
    queryFn: () => api.nft.getByOwner(wallet!),
    enabled: !!wallet,
    staleTime: 30_000,
  })
}


