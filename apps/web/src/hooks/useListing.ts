'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { toast } from 'sonner'
import { useAccount } from 'wagmi'
import { api } from '@/lib/api'
import {
  CONTRACT_ADDRESSES,
  MARKETPLACE_ABI,
  NFT_ABI,
  USDC_ABI,
  USDC_DECIMALS,
} from '@/lib/contracts'
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
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  // Read current approval status for the marketplace
  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, CONTRACT_ADDRESSES.marketplace] : undefined,
    query: { enabled: !!address },
  })

  /**
   * @param tokenId   - NFT token ID
   * @param priceUsdc - Human-readable USDC amount (e.g. "10.50")
   */
  const createListing = async (tokenId: bigint, priceUsdc: string) => {
    if (!address) throw new Error('Wallet not connected')
    const priceRaw = parseUnits(priceUsdc, USDC_DECIMALS)
    
    try {
      // 1. Pre-flight check: canList
      toast.loading('Checking listing requirements…', { id: 'listing' })
      // const canList = await publicClient?.readContract({
      //   address: CONTRACT_ADDRESSES.marketplace,
      //   abi: MARKETPLACE_ABI,
      //   functionName: 'canList',
      //   args: [tokenId, address],
      // })

      // if (!canList) {
      //   toast.error('Cannot list this NFT. Ensure you are the owner and it is unlocked for trading.', { id: 'listing' })
      //   return
      // }

      // 2. Step 1: Approve NFT if not already approved for all
      if (!isApprovedForAll) {
        setStep('approving')
        toast.loading('Step 1/2: Authorizing Marketplace…', { id: 'listing' })
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.nft,
          abi: NFT_ABI,
          functionName: 'setApprovalForAll',
          args: [CONTRACT_ADDRESSES.marketplace, true],
        })
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash })
        await refetchApproval()
      }

      // 3. Step 2: Create the listing
      setStep('listing')
      toast.loading('Step 2/2: Creating listing…', { id: 'listing' })
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'createListing',
        args: [tokenId, priceRaw],
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

export type BuyStep = 'idle' | 'approving-usdc' | 'buying' | 'done'

/**
 * Buy a listed NFT directly with USDC.
 * Steps: 1) approve USDC to marketplace  2) call buyListing
 */
export function useBuyListing() {
  const [step, setStep] = useState<BuyStep>('idle')
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  // Read current USDC allowance granted to marketplace
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.marketplace] : undefined,
    query: { enabled: !!address },
  })

  // Read user's USDC balance
  const { data: usdcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const buyListing = async (tokenId: bigint, price: bigint) => {
    if (!address) throw new Error('Wallet not connected')
    toast.loading('Preparing purchase…', { id: 'buy' })
    
    try {
      // 1. Pre-flight check: canBuy
      const canBuy = await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'canBuy',
        args: [tokenId, address],
      })

      if (!canBuy) {
        toast.error('Cannot buy this NFT. It might be already sold or you are the seller.', { id: 'buy' })
        return
      }

      const currentBalance = usdcBalance ?? BigInt(0)
      if (currentBalance < price) {
        toast.error('Insufficient USDC balance to buy this NFT.', { id: 'buy' })
        setStep('idle')
        return
      }

      // 2. Step 1: Approve USDC if allowance is insufficient
      const currentAllowance = allowance ?? BigInt(0)
      if (currentAllowance < price) {
        setStep('approving-usdc')
        toast.loading('Step 1/2: Approving USDC…', { id: 'buy' })
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.usdc,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.marketplace, price],
        })
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash })
        await refetchAllowance()
      }

      // 3. Step 2: Buy the listing
      setStep('buying')
      toast.loading('Step 2/2: Purchasing NFT…', { id: 'buy' })
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'buyListing',
        args: [tokenId],
      })

      setStep('done')
      toast.success('NFT purchased!', { id: 'buy' })
    } catch (err) {
      setStep('idle')
      toast.error('Purchase failed', { id: 'buy' })
      throw err
    }
  }

  return { buyListing, step }
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
