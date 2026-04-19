'use client'

import { useState } from 'react'
import { useCreateListing } from '@/hooks/useListing'

interface ListingFormProps {
  tokenId: bigint
}


export function ListingForm({ tokenId }: ListingFormProps) {
  const [price, setPrice] = useState('')
  const { createListing, step } = useCreateListing()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!price) return
    await createListing(tokenId, price)
  }

  const isProcessing = step === 'approving' || step === 'listing'

  const stepLabel: Record<typeof step, string> = {
    idle:      'List for Sale',
    approving: 'Step 1/2: Approving NFT…',
    listing:   'Step 2/2: Creating listing…',
    done:      '✓ Listed!',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5" htmlFor="listing-price">
          Listing Price (USDC)
        </label>
        <input
          id="listing-price"
          type="number"
          step="1"
          min="1"
          placeholder="10"
          value={price}
          onChange={e => setPrice(e.target.value)}
          disabled={isProcessing || step === 'done'}
          className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-colors disabled:opacity-50"
        />
      </div>

      {/* Progress indicator */}
      {isProcessing && (
        <div className="flex gap-2">
          {['approving', 'listing'].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors duration-500 ${
                step === s || (step === 'listing' && i === 0)
                  ? 'bg-orange-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!price || isProcessing || step === 'done'}
        className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        {stepLabel[step]}
      </button>
    </form>
  )
}
