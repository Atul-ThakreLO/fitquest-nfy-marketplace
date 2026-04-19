'use client'

import { useReadContract, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { CONTRACT_ADDRESSES, USDC_ABI } from '@/lib/contracts'

/**
 * Read the USDC balance of a wallet.
 */
export function useUSDCBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
}

/**
 * Read the current USDC allowance granted by `owner` to `spender`.
 */
export function useUSDCAllowance(
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined
) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  })
}

/**
 * Returns a function that approves `spender` to spend `amount` USDC on behalf of the caller.
 */
export function useApproveUSDC() {
  const { writeContractAsync } = useWriteContract()

  const approveUSDC = async (spender: `0x${string}`, amount: bigint) => {
    toast.loading('Approving USDC…', { id: 'usdc-approve' })
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.usdc,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [spender, amount],
      })
      toast.success('USDC approved!', { id: 'usdc-approve' })
    } catch (err) {
      toast.error('USDC approval failed', { id: 'usdc-approve' })
      throw err
    }
  }

  return { approveUSDC }
}
