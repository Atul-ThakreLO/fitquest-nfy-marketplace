'use client'

import { useCallback } from 'react'

// Transak is loaded from CDN or npm package - we type the window object
// Install: bun add @transak/transak-sdk
// If the package is not installed yet, the type import below will gracefully degrade
type TransakConfig = {
  apiKey: string
  environment: 'STAGING' | 'PRODUCTION'
  defaultCryptoCurrency: string
  network: string
  walletAddress: string
  widgetHeight?: string
  widgetWidth?: string
  onSuccess?: (data: unknown) => void
  onClose?: () => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transak: new (config: TransakConfig) => any
  }
}

/**
 * Opens the Transak onramp widget.
 * The user buys USDC with a credit card; USDC is delivered directly to their wallet.
 * After the widget closes (or onSuccess fires), the caller should prompt the user
 * to proceed with the USDC payment flow.
 *
 * Requires @transak/transak-sdk to be installed and NEXT_PUBLIC_TRANSAK_API_KEY in .env.
 */
export function useTransak() {
  const openTransak = useCallback(
    (walletAddress: string, onSuccess?: () => void) => {
      const apiKey = process.env.NEXT_PUBLIC_TRANSAK_API_KEY

      if (!apiKey) {
        console.warn('[Transak] NEXT_PUBLIC_TRANSAK_API_KEY is not set')
        return
      }

      // Dynamically import so the SDK is only loaded when needed
      import('@transak/transak-sdk')
        .then(({ Transak }) => {
          const transak = new Transak({
            apiKey,
            environment: 'STAGING', // change to 'PRODUCTION' for mainnet
            defaultCryptoCurrency: 'USDC',
            network: 'base', // Base Sepolia maps to 'base' in Transak
            walletAddress,
            widgetHeight: '650px',
            widgetWidth: '450px',
          } as any)

          transak.init()

          ;(transak as any).on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, () => {
            transak.close()
            onSuccess?.()
          })
        })
        .catch(() => {
          console.error(
            '[Transak] @transak/transak-sdk is not installed. Run: bun add @transak/transak-sdk'
          )
        })
    },
    []
  )

  return { openTransak }
}
