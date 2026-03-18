'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useBuyListing } from '@/hooks/useListing'
import { formatEth } from '@/lib/utils'

interface BuyButtonProps {
  tokenId: bigint
  price: bigint
}

export function BuyButton({ tokenId, price }: BuyButtonProps) {
  const [open, setOpen] = useState(false)
  const { buyListing } = useBuyListing()

  const handleBuy = async () => {
    await buyListing(tokenId, price)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          id={`buy-btn-${tokenId}`}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors"
        >
          Buy Now — {formatEth(price, 3)}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass rounded-2xl p-6 w-full max-w-sm space-y-4">
          <Dialog.Title className="text-lg font-bold text-white">Confirm Purchase</Dialog.Title>
          <Dialog.Description className="text-zinc-400 text-sm">
            You are about to purchase this NFT for{' '}
            <span className="text-orange-400 font-semibold">{formatEth(price)}</span>.
            This action cannot be undone.
          </Dialog.Description>
          <div className="flex gap-3 pt-2">
            <Dialog.Close asChild>
              <button className="flex-1 py-2.5 glass glass-hover rounded-xl text-sm text-zinc-300">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleBuy}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
