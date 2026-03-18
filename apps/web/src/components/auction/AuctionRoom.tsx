'use client'

import Image from 'next/image'
import { useAccount } from 'wagmi'
import { AuctionCountdown } from './AuctionCountdown'
import { BidForm } from './BidForm'
import { LoadingPage } from '@/components/ui/LoadingSpinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuction, useAuctionBids, useFinalizeAuction } from '@/hooks/useAuction'
import { resolveIPFS, formatEth, truncateAddress, formatTimestamp } from '@/lib/utils'

interface AuctionRoomProps {
  auctionId: string
}

export function AuctionRoom({ auctionId }: AuctionRoomProps) {
  const { address } = useAccount()
  const { data: auction, isLoading, isError } = useAuction(auctionId)
  const { data: bids } = useAuctionBids(auctionId)
  const { finalize } = useFinalizeAuction()

  if (isLoading) return <LoadingPage />
  if (isError || !auction) return <ErrorState message="Auction not found." />

  const isEnded = Date.now() / 1000 > auction.endTime
  const isWinner = auction.highestBidder.toLowerCase() === address?.toLowerCase()
  const isSeller = auction.seller.toLowerCase() === address?.toLowerCase()
  const hasNoBids = auction.highestBid === 0n
  const noBidAddr = '0x0000000000000000000000000000000000000000'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Left — Image */}
      <div className="relative aspect-square rounded-3xl overflow-hidden glass">
        <Image
          src={resolveIPFS(auction.tokenId.toString(), '/nft.png')}
          alt={`Auction #${auction.auctionId}`}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Right — Auction info */}
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-zinc-500 text-sm mb-1">Auction #{auction.auctionId.toString()}</p>
          <h1 className="text-3xl font-bold text-white">Token #{auction.tokenId.toString()}</h1>
          <p className="text-zinc-500 text-sm mt-1">by {truncateAddress(auction.seller)}</p>
        </div>

        {/* Countdown */}
        {!isEnded && (
          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">Time remaining</p>
            <AuctionCountdown endTime={auction.endTime} />
          </div>
        )}

        {/* Current bid */}
        <div className="glass rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">
            {isEnded ? 'Winning bid' : 'Highest bid'}
          </p>
          {auction.highestBidder !== noBidAddr ? (
            <>
              <p className="text-4xl font-bold text-orange-400">{formatEth(auction.highestBid)}</p>
              <p className="text-sm text-zinc-400">by {truncateAddress(auction.highestBidder)}</p>
            </>
          ) : (
            <p className="text-zinc-400 italic">No bids yet</p>
          )}
        </div>

        {/* Actions */}
        {!isEnded && !auction.finalized && (
          <BidForm
            auctionId={auction.auctionId}
            highestBid={auction.highestBid}
            startPrice={auction.startPrice}
          />
        )}

        {isEnded && !auction.finalized && (
          <div className="glass rounded-2xl p-5 space-y-3">
            {isWinner && <p className="text-green-400 font-semibold">🏆 You won this auction!</p>}
            {isSeller && hasNoBids && <p className="text-zinc-400">No bids received — NFT will be returned to you.</p>}
            <button
              onClick={() => finalize(auction.auctionId)}
              id={`finalize-auction-${auction.auctionId}`}
              className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors"
            >
              Finalize Auction
            </button>
          </div>
        )}

        {auction.finalized && (
          <div className="glass rounded-2xl p-5">
            <p className="text-zinc-400 italic">This auction has been finalized.</p>
          </div>
        )}

        {/* Bid history */}
        {bids && bids.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">Bid History</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...bids].reverse().map((bid, i) => (
                <div key={i} className="flex justify-between text-sm glass rounded-xl px-4 py-2">
                  <span className="text-zinc-400">{truncateAddress(bid.bidder)}</span>
                  <span className="text-white font-medium">{formatEth(bid.amount, 4)}</span>
                  <span className="text-zinc-600">{formatTimestamp(bid.blockTimestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
