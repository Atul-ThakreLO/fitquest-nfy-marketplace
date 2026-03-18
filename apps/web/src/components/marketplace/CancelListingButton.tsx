'use client'

import { useState } from 'react'
import { useCancelListing } from '@/hooks/useListing'

interface CancelListingButtonProps {
  tokenId: bigint
}

export function CancelListingButton({ tokenId }: CancelListingButtonProps) {
  const { cancelListing } = useCancelListing()
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    setLoading(true)
    try {
      await cancelListing(tokenId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      id={`cancel-listing-${tokenId}`}
      className="w-full py-3 border border-white/20 hover:bg-white/5 text-zinc-400 hover:text-white rounded-xl text-sm transition-colors disabled:opacity-50"
    >
      {loading ? 'Cancelling…' : 'Cancel Listing'}
    </button>
  )
}
