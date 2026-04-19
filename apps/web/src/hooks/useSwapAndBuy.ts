'use client'

import { useState } from 'react'
import { useWriteContract, useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import { toast } from 'sonner'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'

// Since the router ABI wasn't synced yet to 'territory-nft-shared',
// we define the 2 minimal functions we call here directly for now:
const PAYMENT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'buyListingWithETH',
    inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'deadline', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'bidWithETH',
    inputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

export type SwapAndBuyStep = 'idle' | 'swapping-buying' | 'done'

interface SwapAndBuyOptions {
  tokenId: bigint
  usdcPrice: bigint
  slippageFactor?: number
}

/**
 * Perform a seamless 1-transaction buy using ETH via the TerritoryPaymentRouter.
 */
export function useSwapAndBuy() {
  const [step, setStep] = useState<SwapAndBuyStep>('idle')
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const swapAndBuy = async ({
    tokenId,
    usdcPrice: _usdcPrice,
    slippageFactor: _slippageFactor = 1.05,
  }: SwapAndBuyOptions) => {
    if (!address) throw new Error('Wallet not connected')

    try {
      setStep('swapping-buying')
      toast.loading('Processing 1-tx purchase with ETH…', { id: 'swap-buy' })

      // amountInMaximum is the max ETH we send in.
      const amountInMaximum = parseUnits('0.1', 18)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 minutes

      await writeContractAsync({
        address: CONTRACT_ADDRESSES.paymentRouter,
        abi: PAYMENT_ROUTER_ABI,
        functionName: 'buyListingWithETH',
        args: [tokenId, deadline],
        value: amountInMaximum,
      })

      setStep('done')
      toast.success('NFT purchased seamlessly!', { id: 'swap-buy' })
    } catch (err) {
      setStep('idle')
      toast.error('Purchase failed', { id: 'swap-buy' })
      throw err
    }
  }

  return { swapAndBuy, step }
}

/**
 * Perform a seamless 1-transaction bid using ETH via the TerritoryPaymentRouter.
 */
export function useSwapAndBid() {
  const [step, setStep] = useState<SwapAndBuyStep>('idle')
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const swapAndBid = async ({
    auctionId,
    usdcAmount,
    slippageFactor: _slippageFactor = 1.05,
  }: {
    auctionId: bigint
    usdcAmount: bigint
    slippageFactor?: number
  }) => {
    if (!address) throw new Error('Wallet not connected')

    try {
      setStep('swapping-buying')
      toast.loading('Processing 1-tx bid with ETH…', { id: 'swap-bid' })

      const amountInMaximum = parseUnits('0.1', 18)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 minutes

      await writeContractAsync({
        address: CONTRACT_ADDRESSES.paymentRouter,
        abi: PAYMENT_ROUTER_ABI,
        functionName: 'bidWithETH',
        args: [auctionId, usdcAmount, deadline],
        value: amountInMaximum,
      })

      setStep('done')
      toast.success('Bid placed seamlessly!', { id: 'swap-bid' })
    } catch (err) {
      setStep('idle')
      toast.error('Bid failed', { id: 'swap-bid' })
      throw err
    }
  }

  return { swapAndBid, step }
}
