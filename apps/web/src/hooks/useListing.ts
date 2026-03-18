'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { CONTRACT_ADDRESSES, MARKETPLACE_ABI, NFT_ABI } from '@/lib/contracts'
import type { Listing, SaleEvent } from '@/types'

export function useListing(tokenId: string | undefined) {
  return useQuery<Listing, Error>({
    queryKey: ['listing', tokenId],
    queryFn: () => api.marketplace.getListing(tokenId!),
    enabled: !!tokenId,
    staleTime: 15_000,
  })
}

export function useListings(skip = 0, take = 20, rarity?: number, sort?: string) {
  return useQuery<Listing[], Error>({
    queryKey: ['listings', skip, take, rarity, sort],
    queryFn: () => api.marketplace.getListings(skip, take, rarity, sort),
    staleTime: 15_000,
  })
}

export function useListingHistory(tokenId: string | undefined) {
  return useQuery<SaleEvent[], Error>({
    queryKey: ['listing-history', tokenId],
    queryFn: () => api.marketplace.getHistory(tokenId!),
    enabled: !!tokenId,
    staleTime: 60_000,
  })
}

export function useCreateListing() {
  const [step, setStep] = useState<'idle' | 'approving' | 'listing' | 'done'>('idle')
  const { writeContractAsync } = useWriteContract()

  const createListing = async (tokenId: bigint, priceEth: string) => {
    try {
      setStep('approving')
      toast.loading('Step 1/2: Approving NFT…', { id: 'listing' })
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.nft,
        abi: NFT_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.marketplace, tokenId],
      })

      // Wait for approval receipt is done upstream — for simplicity we proceed
      setStep('listing')
      toast.loading('Step 2/2: Creating listing…', { id: 'listing' })
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'createListing',
        args: [tokenId, parseEther(priceEth)],
      })

      setStep('done')
      toast.success('Listing created!', { id: 'listing' })
    } catch (err) {
      setStep('idle')
      toast.error('Listing failed', { id: 'listing' })
      throw err
    }
  }

  return { createListing, step }
}

export function useBuyListing() {
  const { writeContractAsync } = useWriteContract()

  const buyListing = async (tokenId: bigint, price: bigint) => {
    toast.loading('Purchasing NFT…', { id: 'buy' })
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'buyListing',
        args: [tokenId],
        value: price,
      })
      toast.success('NFT purchased!', { id: 'buy' })
    } catch (err) {
      toast.error('Purchase failed', { id: 'buy' })
      throw err
    }
  }

  return { buyListing }
}

export function useCancelListing() {
  const { writeContractAsync } = useWriteContract()

  const cancelListing = async (tokenId: bigint) => {
    toast.loading('Cancelling listing…', { id: 'cancel' })
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'cancelListing',
        args: [tokenId],
      })
      toast.success('Listing cancelled', { id: 'cancel' })
    } catch (err) {
      toast.error('Cancel failed', { id: 'cancel' })
      throw err
    }
  }

  return { cancelListing }
}
