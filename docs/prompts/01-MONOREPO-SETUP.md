# Prompt 01 — Monorepo Setup

> **Cursor instruction**: Scaffold the complete Turborepo monorepo. Do not write application logic yet — only structure, config, and shared packages.

---

## Task

Set up a Turborepo monorepo called `territory-nft` with the following workspace layout. Use **Bun** as the package manager throughout.

## Commands to run first

```bash
bunx create-turbo@latest territory-nft --package-manager bun
cd territory-nft
```

Then restructure to match the layout below exactly.

---

## Final Folder Structure

```
territory-nft/
├── apps/
│   ├── web/                        # Scaffold only (Next.js 14, App Router)
│   └── api/                        # Scaffold only (Bun + Elysia)
├── packages/
│   ├── contracts/                  # Foundry project (not npm)
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── nft.ts          # Rarity enum, NFT types, Listing types
│   │   │   │   ├── auction.ts      # Auction types
│   │   │   │   ├── region.ts       # Region types (game bridge)
│   │   │   │   └── index.ts        # barrel export
│   │   │   ├── abis/
│   │   │   │   ├── TerritoryNFT.json
│   │   │   │   ├── TerritoryMarketplace.json
│   │   │   │   └── TerritoryAuction.json
│   │   │   ├── constants.ts        # Chain IDs, rarity labels, tier colors
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── config/
│       ├── eslint-config/
│       │   └── index.js
│       ├── prettier-config/
│       │   └── index.js
│       └── tsconfig/
│           ├── base.json
│           ├── nextjs.json
│           └── bun.json
├── turbo.json
├── bun.lockb
└── package.json
```

---

## Shared Types to Define (`packages/shared/src/types/nft.ts`)

```typescript
export enum Rarity {
  COMMON    = 0,
  RARE      = 1,
  EPIC      = 2,
  LEGENDARY = 3,
  MYTHIC    = 4,
}

export const RARITY_LABELS: Record<Rarity, string> = {
  [Rarity.COMMON]:    'Common',
  [Rarity.RARE]:      'Rare',
  [Rarity.EPIC]:      'Epic',
  [Rarity.LEGENDARY]: 'Legendary',
  [Rarity.MYTHIC]:    'Mythic',
}

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]:    '#9CA3AF',
  [Rarity.RARE]:      '#60A5FA',
  [Rarity.EPIC]:      '#A78BFA',
  [Rarity.LEGENDARY]: '#FCD34D',
  [Rarity.MYTHIC]:    '#F97316',
}

export interface NFTMetadata {
  name: string
  description: string
  image: string           // ipfs://Qm.../filename.png
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

export interface TokenInfo {
  tokenId: bigint
  rarity: Rarity
  regionId: number
  ipfsCID: string
  firstListed: boolean
  owner: `0x${string}`
}

export interface Listing {
  tokenId: bigint
  seller: `0x${string}`
  price: bigint           // in wei
  active: boolean
  createdAt: number       // unix timestamp
}
```

(`packages/shared/src/types/auction.ts`)

```typescript
export interface Auction {
  auctionId: bigint
  tokenId: bigint
  seller: `0x${string}`
  highestBidder: `0x${string}`
  highestBid: bigint
  startPrice: bigint
  endTime: number         // unix timestamp
  finalized: boolean
}

export interface Bid {
  auctionId: bigint
  bidder: `0x${string}`
  amount: bigint
  blockTimestamp: number
}
```

(`packages/shared/src/types/region.ts`)

```typescript
// Used by game bridge endpoints
export interface Region {
  id: number
  name: string
  element: 'fire' | 'ice' | 'forest' | 'urban' | 'coastal' | 'storm'
  difficulty: number       // 1–100
  nftTokenId: bigint | null
  imageUrl: string | null  // resolved from IPFS CID
  isConquerable: boolean
}

export interface ConquestPayload {
  regionId: number
  walletAddress: `0x${string}`
  stepCount: number
  gameSessionId: string    // from game team, for idempotency
}
```

---

## `packages/shared/src/constants.ts`

```typescript
export const SUPPORTED_CHAIN_ID = 84532 // Base Sepolia

export const AUCTION_MIN_BID_INCREMENT_PERCENT = 5

export const ROYALTY_BASIS_POINTS = 500  // 5%

export const MYTHIC_AUCTION_MIN_DURATION_SECONDS = 3600      // 1 hour
export const MYTHIC_AUCTION_MAX_DURATION_SECONDS = 604800    // 7 days
```

---

## `apps/web` scaffold

Initialize with:

```bash
cd apps/web
bunx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

Install dependencies:

```bash
bun add @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
bun add territory-nft-shared@workspace:*
```

---

## `apps/api` scaffold

```bash
cd apps/api
bun init -y
bun add elysia @elysiajs/cors @elysiajs/swagger @elysiajs/bearer
bun add @prisma/client prisma
bun add viem
bun add pinata
bun add territory-nft-shared@workspace:*
bun add -d @types/bun
```

Entry point `apps/api/src/index.ts`:

```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .get('/health', () => ({ status: 'ok' }))
  .listen(3001)

console.log(`API running at http://localhost:3001`)
export type App = typeof app
```

---

## `packages/contracts` scaffold (Foundry, not npm)

```bash
cd packages/contracts
forge init . --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-git
```

`foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
remappings = [
  "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
]

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
```

---

## `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## ABI Placeholders

Leave `packages/shared/src/abis/*.json` as empty arrays `[]` for now. They will be filled in after the contracts are compiled in Prompt 02 by copying from `packages/contracts/out/`.

Add a script in `packages/shared/package.json`:

```json
{
  "scripts": {
    "sync-abis": "cp ../contracts/out/TerritoryNFT.sol/TerritoryNFT.json ./src/abis/TerritoryNFT.json && cp ../contracts/out/TerritoryMarketplace.sol/TerritoryMarketplace.json ./src/abis/TerritoryMarketplace.json && cp ../contracts/out/TerritoryAuction.sol/TerritoryAuction.json ./src/abis/TerritoryAuction.json"
  }
}
```
