'use client'

import { useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'

export function useContractWrite() {
  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const write = async (
    config: Parameters<typeof writeContract>[0]
  ) => {
    try {
      writeContract(config)
      toast.loading('Transaction submitted…', { id: 'tx' })
    } catch (err) {
      toast.error('Transaction failed')
      throw err
    }
  }

  useEffect(() => {
    if (isSuccess) toast.success('Transaction confirmed!', { id: 'tx' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(error.message?.slice(0, 80) ?? 'Transaction failed', { id: 'tx' })
  }, [error])

  return { write, txHash, isPending, isConfirming, isSuccess }
}
