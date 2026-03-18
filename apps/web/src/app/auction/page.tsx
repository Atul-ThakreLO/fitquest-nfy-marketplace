'use client'

import { AuctionCard } from '@/components/auction/AuctionCard'
import { LoadingPage } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useActiveAuctions } from '@/hooks/useAuction'

export default function AuctionsPage() {
  const { data: auctions, isLoading, isError, refetch } = useActiveAuctions()

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
          Live{' '}
          <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Auctions
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl">
          MYTHIC territories up for grabs. Bid before time runs out.
        </p>
      </div>

      {isLoading ? (
        <LoadingPage />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !auctions?.length ? (
        <EmptyState
          title="No active auctions"
          description="Check back later — MYTHIC territories are rare."
          icon="⏳"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {auctions.map(auction => (
            <AuctionCard key={auction.auctionId.toString()} auction={auction} />
          ))}
        </div>
      )}
    </div>
  )
}
