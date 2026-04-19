'use client'

import { useState } from 'react'
import { Rarity, RARITY_LABELS } from 'territory-nft-shared'
import { NFTCard } from './NFTCard'
import { LoadingPage } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useListings } from '@/hooks/useListing'
import { cn } from '@/lib/utils'

const RARITY_FILTER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: RARITY_LABELS[Rarity.COMMON],    value: Rarity.COMMON },
  { label: RARITY_LABELS[Rarity.RARE],      value: Rarity.RARE },
  { label: RARITY_LABELS[Rarity.EPIC],      value: Rarity.EPIC },
  { label: RARITY_LABELS[Rarity.LEGENDARY], value: Rarity.LEGENDARY },
  { label: RARITY_LABELS[Rarity.MYTHIC],    value: Rarity.MYTHIC },
]

const SORT_OPTIONS = [
  { label: 'Newest',  value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
]

const PAGE_SIZE = 20

export function NFTGrid() {
  const [selectedRarity, setSelectedRarity] = useState<Rarity | undefined>(undefined)
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)

  const { data: listings, isLoading, isError, refetch } = useListings(
    page * PAGE_SIZE,
    PAGE_SIZE,
    selectedRarity,
    sort
  )

  const handleRarityChange = (value: Rarity | undefined) => {
    setSelectedRarity(value)
    setPage(0)
  }

  

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Rarity chips */}
        <div className="flex flex-wrap gap-2">
          {RARITY_FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => handleRarityChange(value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedRarity === value
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'glass glass-hover text-zinc-300 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => { setSort(e.target.value); setPage(0) }}
          className="bg-surface-2 border border-white/10 text-zinc-300 text-sm rounded-lg px-3 py-1.5 outline-none focus:border-orange-400 transition-colors"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <LoadingPage />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !listings?.length ? (
        <EmptyState
          title="No listings found"
          description="Be the first to list a Territory NFT!"
          icon="🏔️"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {listings.map(listing => (
              <NFTCard
                key={listing.tokenId.toString()}
                token={{ tokenId: listing.tokenId, rarity: listing.rarity, ipfsCID: "", firstListed: true, owner: listing.seller }}
                listing={listing}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-3 pt-4">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 glass glass-hover rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="px-4 py-2 text-zinc-400 text-sm">Page {page + 1}</span>
            <button
              disabled={!listings || listings.length < PAGE_SIZE}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 glass glass-hover rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
