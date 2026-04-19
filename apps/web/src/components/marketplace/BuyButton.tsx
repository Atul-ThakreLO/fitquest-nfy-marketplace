'use client'

import { PaymentModal } from './PaymentModal'

interface BuyButtonProps {
  tokenId: bigint
  price: bigint
}

/**
 * Renders the "Buy Now" trigger that opens the multi-method PaymentModal.
 * All payment logic has been moved into PaymentModal / payment hooks.
 */
export function BuyButton({ tokenId, price }: BuyButtonProps) {
  return <PaymentModal tokenId={tokenId} price={price} />
}
