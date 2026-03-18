'use client'

import { useState } from 'react'
import { formatEther } from 'viem'
import { usePlaceBid } from '@/hooks/useAuction'
import { AUCTION_MIN_BID_INCREMENT_PERCENT } from 'territory-nft-shared'

interface BidFormProps {
  auctionId: bigint
  highestBid: bigint
  startPrice: bigint
}

export function BidForm({ auctionId, highestBid, startPrice }: BidFormProps) {
  const base = highestBid > 0n ? highestBid : startPrice
  const minBid = base + (base * BigInt(AUCTION_MIN_BID_INCREMENT_PERCENT)) / 100n
  const minBidEth = parseFloat(formatEther(minBid)).toFixed(5)

  const [bidAmount, setBidAmount] = useState(minBidEth)
  const { placeBid } = usePlaceBid()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await placeBid(auctionId, bidAmount)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="bid-amount">
          Your bid (ETH) — min {minBidEth} ETH
        </label>
        <input
          id="bid-amount"
          type="number"
          step="0.00001"
          min={minBidEth}
          value={bidAmount}
          onChange={e => setBidAmount(e.target.value)}
          className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={loading || parseFloat(bidAmount) < parseFloat(minBidEth)}
        id={`place-bid-${auctionId}`}
        className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? 'Placing bid…' : 'Place Bid'}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        ⚠️ Bidding in the last 10 minutes extends the auction by 10 minutes.
      </p>
    </form>
  )
}
