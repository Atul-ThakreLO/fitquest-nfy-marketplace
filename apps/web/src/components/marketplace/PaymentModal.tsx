'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useAccount } from 'wagmi'
import { useBuyListing } from '@/hooks/useListing'
import { useSwapAndBuy } from '@/hooks/useSwapAndBuy'
import { useTransak } from '@/hooks/useTransak'
import { formatUsdc } from '@/lib/utils'

interface PaymentModalProps {
  tokenId: bigint
  /** USDC price in micro-units (6 decimals) */
  price: bigint
}

type PaymentMethod = 'usdc' | 'eth' | 'card'
type Phase = 'select' | 'confirm'

const METHOD_LABELS: Record<PaymentMethod, { icon: string; title: string; desc: string }> = {
  usdc: { icon: '💵', title: 'Pay with USDC', desc: 'Direct transfer · cheapest gas' },
  eth:  { icon: '⟠',  title: 'Pay with ETH',  desc: 'Auto-swap via Uniswap · 5% slippage' },
  card: { icon: '💳', title: 'Pay with Card',  desc: 'Powered by Transak onramp' },
}

export function PaymentModal({ tokenId, price }: PaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [, setPhase] = useState<Phase>('select')
  const [selected, setSelected] = useState<PaymentMethod>('usdc')

  const { address } = useAccount()
  const { buyListing, step: usdcStep } = useBuyListing()
  const { swapAndBuy, step: swapStep } = useSwapAndBuy()
  const { openTransak } = useTransak()

  const isProcessing =
    usdcStep !== 'idle' && usdcStep !== 'done' ||
    swapStep !== 'idle' && swapStep !== 'done'

  const handleClose = () => {
    if (!isProcessing) {
      setOpen(false)
      setPhase('select')
    }
  }

  const handleConfirm = async () => {
    if (!address) return
    try {
      if (selected === 'usdc') {
        await buyListing(tokenId, price)
        setOpen(false)
      } else if (selected === 'eth') {
        await swapAndBuy({ tokenId, usdcPrice: price })
        setOpen(false)
      } else if (selected === 'card') {
        handleClose()
        openTransak(address, () => {
          // After Transak delivers USDC — open modal again on USDC path
          setSelected('usdc')
          setPhase('confirm')
          setOpen(true)
        })
      }
    } catch {
      // Errors are toasted by the hooks
    }
  }

  const stepLabel = (() => {
    if (selected === 'eth') {
      const labels: Record<string, string> = {
        idle:          'Confirm',
        quoting:       'Quoting swap…',
        swapping:      'Swapping ETH → USDC…',
        'approving-usdc': 'Approving USDC…',
        buying:        'Purchasing…',
        done:          '✓ Done',
      }
      return labels[swapStep] ?? 'Confirm'
    }
    const labels: Record<string, string> = {
      idle:          'Confirm',
      'approving-usdc': 'Approving USDC…',
      buying:        'Purchasing…',
      done:          '✓ Done',
    }
    return labels[usdcStep] ?? 'Confirm'
  })()

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true) }}>
      <Dialog.Trigger asChild>
        <button
          id={`buy-btn-${tokenId}`}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors"
        >
          Buy Now — {formatUsdc(price)}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass rounded-2xl p-6 w-full max-w-sm space-y-5">
          <Dialog.Title className="text-lg font-bold text-white">
            Purchase NFT
          </Dialog.Title>

          {/* Price summary */}
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Total</span>
            <span className="text-orange-400 font-bold">{formatUsdc(price)}</span>
          </div>

          {/* Payment method selector */}
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Payment method</p>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(method => {
              const m = METHOD_LABELS[method]
              const active = selected === method
              return (
                <button
                  key={method}
                  onClick={() => setSelected(method)}
                  disabled={isProcessing}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                    active
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.title}</p>
                    <p className="text-xs text-zinc-500">{m.desc}</p>
                  </div>
                  {active && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {selected === 'eth' && (
              <p className="text-[10px] text-zinc-500 text-center uppercase tracking-wide font-medium">
                ⚠️ This transaction will expire in 5 minutes to prevent slippage
              </p>
            )}
            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button
                  disabled={isProcessing}
                  className="flex-1 py-2.5 glass glass-hover rounded-xl text-sm text-zinc-300 disabled:opacity-50"
                >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {stepLabel}
            </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
