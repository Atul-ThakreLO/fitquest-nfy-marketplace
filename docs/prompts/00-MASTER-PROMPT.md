# Territory NFT System — Master Cursor Prompt

> Use this file as the **project context** in Cursor. Pin it. Refer sub-agents to the relevant section prompt when working on a specific layer.

---

## Project Summary

We are building a **blockchain-based NFT system** for a fitness mobile app where users walk to conquer geographic territories. Instead of showing conquered areas via color fills on a map, each territory tile is represented by an **NFT with unique artwork**.

This project is **NOT** the game/mobile app itself — that is built by a separate team. Our deliverable is:

1. **Smart contracts** — NFT minting, marketplace, and auction logic
2. **Backend API** — offchain orchestration, Pinata bridge, walk-to-NFT linking
3. **Web marketplace** — browse, buy, sell, and auction NFTs

### The game↔marketplace link
The mobile game team will call our backend API to:
- Query which NFT token is assigned to a given `regionId`
- Get the NFT image/metadata URL so the map can render it as a tile overlay
- Notify us when a user has walked a region (triggers conquest logic)

We expose a clean REST API for this. The game team does not interact with the blockchain directly.

---

## Tech Stack — Locked Choices

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.x, Foundry, OpenZeppelin 5.x |
| Chain | Base (L2) — testnet: Base Sepolia |
| Contract interaction | Viem |
| Wallet connection | RainbowKit + Wagmi v2 |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend runtime | **Bun + Elysia** (chosen for type-safety, speed, and Cursor AI debuggability) |
| Database | PostgreSQL via Prisma ORM |
| NFT storage | Pinata SDK (IPFS) |
| Event indexing | The Graph (hosted service or self-hosted) |
| Monorepo | Turborepo |
| Package manager | Bun (workspaces) |

> **Why Bun + Elysia over Node + Express?**  
> Elysia has end-to-end TypeScript types, built-in validation (no Zod boilerplate), OpenAPI docs auto-generated, and Bun's native speed. Cursor handles it very well since the codebase is smaller and more explicit than Express.

---

## Folder Structure (Monorepo)

```
territory-nft/
├── apps/
│   ├── web/                    # Next.js 14 marketplace frontend
│   └── api/                    # Bun + Elysia backend
├── packages/
│   ├── contracts/              # Foundry smart contracts
│   ├── shared/                 # Shared TypeScript types, ABIs, constants
│   └── config/                 # Shared ESLint, Prettier, TS config
├── turbo.json
├── bun.lockb
└── package.json
```

---

## Sub-Prompt Index

Work through these in order. Each is a standalone Cursor prompt:

| # | File | What it builds |
|---|---|---|
| 01 | `01-MONOREPO-SETUP.md` | Turborepo scaffold, shared config, shared types |
| 02 | `02-SMART-CONTRACTS.md` | All three Solidity contracts + Foundry tests |
| 03 | `03-SUBGRAPH.md` | The Graph subgraph for event indexing |
| 04 | `04-BACKEND-API.md` | Bun + Elysia API, Prisma, Pinata, game bridge |
| 05 | `05-WEB-MARKETPLACE.md` | Next.js marketplace frontend |
| 06 | `06-ADMIN-PANEL.md` | Org admin UI (mint + first-list) |
| 07 | `07-GAME-BRIDGE-DOCS.md` | API contract docs for the mobile game team |

---

## NFT Rarity Tiers

```typescript
enum Rarity {
  COMMON     = 0,
  RARE       = 1,
  EPIC       = 2,
  LEGENDARY  = 3,
  MYTHIC     = 4,
}
```

- **COMMON / RARE / EPIC / LEGENDARY**: Fixed-price marketplace only
- **MYTHIC**: Fixed-price OR auction (owner's choice)
- Only `MYTHIC` tier NFTs can be auctioned

---

## Access Control Model

```
DEFAULT_ADMIN_ROLE → org Gnosis Safe multisig
MINTER_ROLE        → org backend hot wallet (env: MINTER_PRIVATE_KEY)
LISTER_ROLE        → org backend hot wallet (same wallet)
```

- **Only MINTER_ROLE** can call `safeMint()`
- **firstListed flag**: after org performs initial listing, user owns full trading rights
- Users can list/delist/auction freely once `firstListed = true` on their token

---

## Key Data Relationships

```
Region (offchain, in game)
  └── has one NFT Token (onchain)
       └── has one IPFS metadata (Pinata)
            └── has one image (Pinata)

User Wallet
  └── owns N Tokens
       └── can list N tokens (fixed price)
       └── can auction N MYTHIC tokens
```

---

## Environment Variables Required

```env
# Shared
NEXT_PUBLIC_CHAIN_ID=84532               # Base Sepolia
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=
NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS=

# API only
DATABASE_URL=postgresql://...
MINTER_PRIVATE_KEY=                      # Hot wallet, MINTER_ROLE
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
PINATA_GATEWAY_URL=https://gateway.pinata.cloud
GAME_API_SECRET=                         # Shared secret for game team calls

# Frontend only
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_GRAPH_API_URL=
```

---

## Non-Negotiables for All Code

- **No placeholder logic** — every function must be fully implemented, not stubbed
- **Use prebuilt libraries** — never reimplement what OpenZeppelin, RainbowKit, Wagmi, Prisma, or Elysia already provides
- **TypeScript strict mode** everywhere
- **No `any` types**
- All contract addresses come from environment variables, never hardcoded
- All blockchain writes go through the user's wallet (via Wagmi), never through a backend signer (except org mint/list operations)
- Handle loading, error, and empty states in every UI component
