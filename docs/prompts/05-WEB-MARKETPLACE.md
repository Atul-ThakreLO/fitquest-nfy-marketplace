# Prompt 05 — Web Marketplace (Next.js 14)

> **Cursor instruction**: Build the complete web marketplace inside `apps/web/`. Use RainbowKit + Wagmi v2 for wallet. Use Viem for contract reads/writes. Use TanStack Query for data fetching. Do not write wallet connection logic from scratch — RainbowKit handles all of it.

---

## Final Folder Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Home / browse marketplace
│   ├── nft/
│   │   └── [tokenId]/
│   │       └── page.tsx              # NFT detail page
│   ├── auction/
│   │   ├── page.tsx                  # All active auctions
│   │   └── [auctionId]/
│   │       └── page.tsx              # Live auction room
│   ├── profile/
│   │   └── [wallet]/
│   │       └── page.tsx              # User profile + owned NFTs
│   └── admin/
│       └── page.tsx                  # Org admin panel (mint + first-list)
├── components/
│   ├── providers/
│   │   └── Web3Provider.tsx          # RainbowKit + Wagmi + TanStack Query
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── nft/
│   │   ├── NFTCard.tsx               # Grid card
│   │   ├── NFTGrid.tsx               # Responsive grid with filters
│   │   ├── NFTDetail.tsx             # Full detail view
│   │   ├── RarityBadge.tsx           # Colored tier badge
│   │   └── PriceHistory.tsx          # Chart of past sales
│   ├── marketplace/
│   │   ├── ListingForm.tsx           # Create/update listing
│   │   ├── BuyButton.tsx             # Buy with confirmation modal
│   │   └── CancelListingButton.tsx
│   ├── auction/
│   │   ├── AuctionCard.tsx
│   │   ├── AuctionRoom.tsx           # Live bid feed + countdown
│   │   ├── BidForm.tsx
│   │   └── AuctionCountdown.tsx      # Real-time countdown timer
│   └── ui/
│       ├── ConnectButton.tsx         # Thin wrapper around RainbowKit ConnectButton
│       ├── LoadingSpinner.tsx
│       ├── EmptyState.tsx
│       └── ErrorState.tsx
├── hooks/
│   ├── useNFT.ts                     # Read token data
│   ├── useListing.ts                 # Read + write listing
│   ├── useAuction.ts                 # Read + write auction
│   ├── useOwnedNFTs.ts               # Tokens by wallet
│   └── useContractWrite.ts           # Shared write pattern with toast feedback
├── lib/
│   ├── wagmi.config.ts               # Wagmi + RainbowKit config
│   ├── contracts.ts                  # Contract addresses + typed Viem instances
│   └── api.ts                        # Typed fetch wrapper for backend API
├── constants/
│   └── rarity.ts                     # RARITY_LABELS, RARITY_COLORS (from shared)
└── types/
    └── index.ts                      # Re-export from shared package
```

---

## `src/lib/wagmi.config.ts`

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Territory NFT Marketplace',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [baseSepolia],
  ssr: true,
})
```

---

## `src/components/providers/Web3Provider.tsx`

```typescript
'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi.config'
import { useState } from 'react'

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

Wrap `app/layout.tsx` with `<Web3Provider>`.

---

## `src/lib/contracts.ts`

```typescript
import { getContract } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import TerritoryNFTAbi from 'territory-nft-shared/abis/TerritoryNFT.json'
import TerritoryMarketplaceAbi from 'territory-nft-shared/abis/TerritoryMarketplace.json'
import TerritoryAuctionAbi from 'territory-nft-shared/abis/TerritoryAuction.json'

export const CONTRACT_ADDRESSES = {
  nft:         process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS         as `0x${string}`,
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auction:     process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS     as `0x${string}`,
} as const

// Use these in hooks with usePublicClient() / useWalletClient()
export const NFT_ABI         = TerritoryNFTAbi         as const
export const MARKETPLACE_ABI = TerritoryMarketplaceAbi as const
export const AUCTION_ABI     = TerritoryAuctionAbi     as const
```

---

## `src/lib/api.ts`

Typed fetch wrapper for the Elysia backend:

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message ?? 'API error')
  return json.data as T
}

export const api = {
  nft: {
    getByTokenId: (tokenId: string) =>
      apiFetch<TokenInfo>(`/nft/${tokenId}`),
    getByRegion: (regionId: number) =>
      apiFetch<TokenInfo>(`/nft/region/${regionId}`),
    getByOwner: (wallet: string) =>
      apiFetch<TokenInfo[]>(`/nft/owner/${wallet}`),
  },
  marketplace: {
    getListings: (skip = 0, take = 20) =>
      apiFetch<Listing[]>(`/marketplace/listings?skip=${skip}&take=${take}`),
    getListing: (tokenId: string) =>
      apiFetch<Listing>(`/marketplace/listings/${tokenId}`),
    getHistory: (tokenId: string) =>
      apiFetch<SaleEvent[]>(`/marketplace/history/${tokenId}`),
  },
  auction: {
    getActive: () => apiFetch<Auction[]>('/auction/active'),
    getById: (id: string) => apiFetch<Auction>(`/auction/${id}`),
    getBids: (id: string) => apiFetch<Bid[]>(`/auction/${id}/bids`),
  },
}
```

---

## Key Hooks

### `src/hooks/useContractWrite.ts`

Shared pattern for all contract writes:

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { toast } from 'sonner'  // bun add sonner

export function useContractWrite() {
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const write = async (config: Parameters<typeof writeContract>[0], successMessage: string) => {
    try {
      writeContract(config)
      toast.loading('Transaction submitted...')
    } catch (err) {
      toast.error('Transaction failed')
      throw err
    }
  }

  // Show success toast when confirmed
  useEffect(() => {
    if (isSuccess) toast.success(successMessage)
  }, [isSuccess])

  return { write, txHash, isPending, isConfirming, isSuccess }
}
```

### `src/hooks/useListing.ts`

```typescript
// Reads: use api.marketplace.getListing (TanStack Query)
// Write: createListing → approve NFT first, then createListing
//        buyListing → useContractWrite with value = listing.price
//        cancelListing → useContractWrite
```

The `createListing` flow MUST:
1. First call `approve(marketplaceContractAddress, tokenId)` on the NFT contract
2. Wait for that tx to confirm
3. Then call `createListing(tokenId, price)` on the marketplace contract

Use `useWriteContract` in sequence. Show a 2-step progress indicator to the user: "Step 1/2: Approving NFT..." → "Step 2/2: Creating listing..."

---

## Key Pages

### `app/page.tsx` — Marketplace Home

- Filter bar: rarity chips (ALL, COMMON, RARE, EPIC, LEGENDARY, MYTHIC)
- Sort: Price ↑, Price ↓, Newest
- `NFTGrid` with pagination (load more button, not infinite scroll)
- Render each `NFTCard` with: image, name, rarity badge, price, Buy button

### `app/nft/[tokenId]/page.tsx` — NFT Detail

Sections:
1. **Hero**: large image (resolved IPFS URL via Pinata gateway), name, rarity badge
2. **Attributes**: trait grid (element, region, difficulty, etc.)
3. **Current status**: active listing price + Buy button, OR active auction + link, OR "Not listed"
4. **Ownership**: current owner address (ENS resolved via Wagmi's `useEnsName`)
5. **Price history**: chart using Recharts (line chart) with data from `api.marketplace.getHistory`
6. **If owned by connected wallet**: show List for Sale / Create Auction (MYTHIC only) / Cancel Listing buttons

### `app/auction/[auctionId]/page.tsx` — Auction Room

- Large NFT image + metadata
- Countdown timer (live, `useInterval` or `setInterval`)
- Current highest bid + bidder (truncated address)
- Bid history (live-updating, poll every 15s or use WebSocket if available)
- `BidForm`: input for bid amount (pre-filled with `highestBid * 1.05`), "Place Bid" button
- Anti-snipe notice: "Bidding in the last 10 minutes extends the auction by 10 minutes"
- If auction ended: show winner or "No bids — NFT returned to seller"

### `app/profile/[wallet]/page.tsx` — User Profile

- Wallet address + ENS name
- Grid of owned NFTs (from `api.nft.getByOwner`)
- Conquest history (from `api.game-bridge.getConquests`) — show as timeline
- "My Active Listings" section

---

## `src/components/nft/RarityBadge.tsx`

```typescript
import { Rarity, RARITY_LABELS, RARITY_COLORS } from 'territory-nft-shared'

const RARITY_BG: Record<Rarity, string> = {
  [Rarity.COMMON]:    'bg-gray-100 text-gray-600',
  [Rarity.RARE]:      'bg-blue-100 text-blue-700',
  [Rarity.EPIC]:      'bg-purple-100 text-purple-700',
  [Rarity.LEGENDARY]: 'bg-yellow-100 text-yellow-700',
  [Rarity.MYTHIC]:    'bg-orange-100 text-orange-700 font-semibold ring-1 ring-orange-300',
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${RARITY_BG[rarity]}`}>
      {RARITY_LABELS[rarity]}
    </span>
  )
}
```

---

## Admin Panel (`app/admin/page.tsx`)

Protected: check `useAccount().address` matches org wallet address (from env), redirect otherwise.

**Mint form fields:**
- Region ID (number)
- Rarity (select: COMMON → MYTHIC)
- NFT name
- Description
- Image upload (file picker → base64)
- Custom attributes (dynamic key/value pairs, add/remove rows)
- Listing price in ETH

On submit: POST to `/admin/mint` with org bearer token.

Show MintJob status polling after submission: display status progression (`pending → uploading → minting → done`), final tokenId and Basescan link.

**First-listing management:**
- Table of all minted tokens where `firstListed === false`
- "List" button per row that opens a price input modal
- Calls backend which executes `markFirstListed` + marketplace listing

---

## Tailwind Configuration

Add rarity colors to `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      rarity: {
        common:    '#9CA3AF',
        rare:      '#60A5FA',
        epic:      '#A78BFA',
        legendary: '#FCD34D',
        mythic:    '#F97316',
      }
    }
  }
}
```

---

## Additional Libraries to Install

```bash
bun add sonner           # Toast notifications
bun add recharts         # Price history chart
bun add @radix-ui/react-dialog @radix-ui/react-select  # Modals, selects
bun add date-fns         # Auction countdown formatting
bun add viem             # Already in workspace
```

---

## IPFS Image Rendering

Never render `ipfs://` URLs directly in `<img>` tags. Always resolve through Pinata gateway:

```typescript
export function resolveIPFS(cid: string, path = ''): string {
  return `${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${cid}${path}`
}
```

Use `next/image` with this resolved URL. Add Pinata gateway domain to `next.config.js` `images.domains`.
