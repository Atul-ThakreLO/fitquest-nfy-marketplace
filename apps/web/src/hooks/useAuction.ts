'use client'

import { useQuery } from '@tanstack/react-query'
import { useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { CONTRACT_ADDRESSES, AUCTION_ABI } from '@/lib/contracts'
import type { Auction, Bid } from '@/types'

export function useActiveAuctions() {
  return useQuery<Auction[], Error>({
    queryKey: ['auctions', 'active'],
    queryFn: () => api.auction.getActive(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  })
}

export function useAuction(auctionId: string | undefined) {
  return useQuery<Auction, Error>({
    queryKey: ['auction', auctionId],
    queryFn: () => api.auction.getById(auctionId!),
    enabled: !!auctionId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function useAuctionBids(auctionId: string | undefined) {
  return useQuery<Bid[], Error>({
    queryKey: ['auction-bids', auctionId],
    queryFn: () => api.auction.getBids(auctionId!),
    enabled: !!auctionId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

export function usePlaceBid() {
  const { writeContractAsync } = useWriteContract()

  const placeBid = async (auctionId: bigint, bidEth: string) => {
    toast.loading('Placing bid…', { id: 'bid' })
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: 'placeBid',
        args: [auctionId],
        value: parseEther(bidEth),
      })
      toast.success('Bid placed!', { id: 'bid' })
    } catch (err) {
      toast.error('Bid failed', { id: 'bid' })
      throw err
    }
  }

  return { placeBid }
}

export function useFinalizeAuction() {
  const { writeContractAsync } = useWriteContract()

  const finalize = async (auctionId: bigint) => {
    toast.loading('Finalising auction…', { id: 'finalize' })
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: 'finalizeAuction',
        args: [auctionId],
      })
      toast.success('Auction finalised!', { id: 'finalize' })
    } catch (err) {
      toast.error('Finalise failed', { id: 'finalize' })
      throw err
    }
  }

  return { finalize }
}
