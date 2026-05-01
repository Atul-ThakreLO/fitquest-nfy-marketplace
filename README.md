# Territory NFT Marketplace

A full-stack Web3 DApp for minting, trading, and auctioning geographic territory NFTs on the **Base** network. Built as a Turborepo monorepo with a **Next.js 14** frontend, an **Elysia** backend API with Redis caching, **Foundry**-tested Solidity smart contracts, and a **The Graph** subgraph for indexed on-chain data.

---

## 📋 Table of Contents

- [Features](#-features)
- [Deployed Contracts (Base Sepolia)](#-deployed-contracts-base-sepolia)
- [Architecture](#-architecture)
- [Monorepo Structure](#-monorepo-structure)
- [Smart Contracts](#-smart-contracts)
- [Backend API](#-backend-api)
- [Frontend Web App](#-frontend-web-app)
- [Game Bridge API](#-game-bridge-api)
- [CLI Minting Tool](#-cli-minting-tool)
- [Installation & Setup](#-installation--setup)
- [Testing](#-testing)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### NFT & Marketplace

- **Geographic Territory NFTs** — Each token represents a unique geographic tile, minted as an ERC-721 with IPFS-hosted metadata and artwork.
- **5-Tier Rarity System** — `COMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC` — each tier visually distinct with on-chain rarity stored.
- **Fixed-Price Marketplace** — Create, update, and cancel USDC-priced listings. Royalties (5%, ERC-2981) are automatically calculated and distributed.
- **English Auctions** — Exclusive to `MYTHIC`-tier NFTs. Features a 5% minimum bid increment, anti-sniping 10-minute extension, and secure escrow with withdrawable pending returns.
- **First-Listing Guard** — Transfers are locked until the org performs the initial listing (`firstListed` flag), ensuring a controlled primary market.

### Payments

- **USDC Payments** — All marketplace and auction transactions settle in USDC (Circle's testnet USDC on Base Sepolia).
- **Pay with ETH** — A `TerritoryPaymentRouter` contract atomically swaps ETH → USDC via Uniswap V3, purchases the NFT, and refunds unspent ETH — all in a single transaction.
- **Pay with Card** — Transak fiat onramp integration lets users buy USDC with a credit card directly from the purchase modal.
- **Transaction Deadlines** — ETH payment routes enforce a `deadline` timestamp to prevent stale mempool transactions.

### Frontend Experience

- **Multi-Method Payment Modal** — Choose between USDC, ETH (auto-swap), or credit card at checkout.
- **Wallet Integration** — Wagmi + RainbowKit for seamless wallet connection.
- **Live Auction Room** — Real-time countdown, bid history, bidder leaderboard, seller dashboard with insights, and pending-return withdrawal.
- **Price History Charts** — Recharts-powered visualizations for marketplace sales and auction bids.
- **ENS Resolution** — Owner addresses resolve to ENS names when available.
- **Admin Dashboard** — Web-based form for minting new NFTs with image upload, attribute editing, and live job status tracking.

### Backend & Infrastructure

- **Elysia API on Bun** — High-performance TypeScript API with bearer auth, Swagger docs, and structured error handling.
- **Redis Caching** — 30-second TTL cache on marketplace listings with webhook-driven invalidation.
- **The Graph Subgraph** — Indexes all on-chain events (mints, listings, sales, auctions, bids) for fast querying.
- **IPFS via Pinata** — NFT images and metadata uploaded to IPFS with gateway-resolved HTTPS URLs.
- **Keystore Security** — Admin wallet secured via Foundry encrypted keystore with interactive password prompt at server startup.
- **Game Bridge API** — Authenticated REST endpoints for mobile game integration (region data, conquest tracking).

### Developer Experience

- **Turborepo + Bun** — Fast monorepo builds with caching and parallel task execution.
- **Foundry Test Suite** — 51 unit/fuzz tests covering all contracts, including gas baseline snapshots.
- **CLI Minting Tool** — Interactive terminal tool for admin NFT minting with image encoding, attribute collection, and job polling.
- **Swagger Documentation** — Auto-generated API docs at `/docs`.
- **Shared Packages** — ABIs, TypeScript types, and constants shared across all apps.

---

## 📍 Deployed Contracts (Base Sepolia)

| Contract               | Address                                        |
| ---------------------- | ---------------------------------------------- |
| **TerritoryNFT**       | `0x6c9F32c9cec98Ccb78eB2382aCBB268801FD6941`   |
| **TerritoryMarketplace** | `0xCA62A34eF6C49e8604Ca88A72A7cb6E2D4A101a9` |
| **TerritoryAuction**   | `0xaEb4F9E488F8B8315CE799a65cC217775acB3282`   |
| **TerritoryPaymentRouter** | `0x1aE62E2368F4D8ADF61151D5fAf32dF493aF5657` |
| **USDC (payment token)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## 🏗 Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     Web Marketplace (Next.js 14)                    │
│          Wagmi · RainbowKit · React Query · Tailwind CSS            │
│     Recharts · Radix UI · Sonner · Transak SDK · Inter font        │
└──────────┬─────────────────────────────┬──────────────────┬─────────┘
           │                             │                  │
 HTTP/REST │                  Web3 (RPC) │      The Graph   │
           ▼                             │       (GQL)      │
┌──────────────────────────────┐         │                  │
│     Backend API (Elysia)     │         │                  │
│  Bun · Redis · Pinata IPFS   │         │                  │
│  Viem/Ethers · Bearer Auth   │         │                  │
│  Swagger · Encrypted         │         │                  │
│  Keystore Wallet             │         │                  │
└──────────┬───────────────────┘         │                  │
           │                             │                  │
           ▼                             ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Smart Contracts (Foundry)                         │
│  TerritoryNFT · TerritoryMarketplace · TerritoryAuction             │
│  TerritoryPaymentRouter (Uniswap V3 ETH→USDC swap)                 │
│  Solidity ^0.8.24 · OpenZeppelin · ERC-721 · ERC-2981              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     The Graph Subgraph                               │
│  Indexes: Token · Listing · Sale · Auction · Bid · User             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Structure

```
territory-nft/
├── apps/
│   ├── api/                    # Elysia backend API (Bun runtime)
│   │   └── src/
│   │       ├── routes/         # mint, marketplace, auction, nft
│   │       ├── services/       # contract, graph, pinata services
│   │       ├── lib/            # redis, viem (keystore wallet)
│   │       └── middleware/     # bearer auth
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/            # Pages: /, /nft/[id], /auction, /profile, /admin
│           ├── components/     # NFT, marketplace, auction, layout, UI, providers
│           ├── hooks/          # useNFT, useListing, useAuction, useSwapAndBuy, useTransak, useUSDC
│           └── lib/            # API client, contract ABIs, wagmi config, utils
├── packages/
│   ├── contracts/              # Foundry project (Solidity contracts + tests)
│   ├── shared/                 # Shared ABIs, TypeScript types, constants
│   ├── subgraph/               # The Graph subgraph (schema, mappings)
│   └── config/                 # Shared configurations
├── tools/
│   └── mint/                   # CLI minting tool (Bun + inquirer)
├── docs/
│   └── prompts/                # Development prompts and references
├── turbo.json                  # Turborepo pipeline config
├── docker-compose.dev.yml      # Redis dev service
└── package.json                # Workspace root (Bun)
```

---

## 📜 Smart Contracts

Written in **Solidity ^0.8.24** with **OpenZeppelin** standards. All contracts are deployed on **Base Sepolia**.

### TerritoryNFT.sol

The core ERC-721 token representing geographic territory tiles.

| Feature            | Detail                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| **Standard**       | ERC-721 (ERC721URIStorage) + ERC-2981 royalties + AccessControl        |
| **Minting**        | Restricted to `MINTER_ROLE`; auto-incrementing token IDs starting at 1 |
| **Rarity**         | On-chain enum: `COMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC`         |
| **Metadata**       | IPFS CIDs stored on-chain; tokenURI → `ipfs://{cid}/metadata.json`     |
| **Transfer Guard** | Transfers blocked until `firstListed` flag set by `LISTER_ROLE`        |
| **Royalties**      | 5% default royalty (500 basis points) via ERC-2981                     |

### TerritoryMarketplace.sol

A decentralized fixed-price trading platform for all territory NFTs.

| Feature          | Detail                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| **Currency**     | All prices in USDC (6 decimals)                                           |
| **Listings**     | Create, update price, and cancel listings                                 |
| **Purchasing**   | Atomic USDC transfer + NFT delivery; supports `buyListingFor` delegation  |
| **Royalties**    | Auto-distributes 5% ERC-2981 royalty capped at 15% to prevent underflows  |
| **Pre-flight**   | `canList()` and `canBuy()` view functions for proactive UI validation      |
| **Gas Safety**   | Uses `transferFrom` (not `safeTransferFrom`) to avoid unbounded gas costs  |

### TerritoryAuction.sol

English-style auctions exclusively for `MYTHIC`-tier NFTs.

| Feature            | Detail                                                           |
| ------------------ | ---------------------------------------------------------------- |
| **Bid Increment**  | 5% minimum above the current highest bid                         |
| **Anti-Sniping**   | Auto-extends by 10 minutes if bid placed in final 10 minutes     |
| **Escrow**         | Outbid amounts tracked as pending returns for safe withdrawal    |
| **Finalization**   | Callable by anyone post-deadline; handles no-bid return gracefully |
| **Royalty Cap**    | 15% cap on finalization to prevent arithmetic edge cases          |
| **Role**           | Holds `LISTER_ROLE` to bypass the first-listing transfer guard    |

### TerritoryPaymentRouter.sol

A helper router enabling ETH payments via Uniswap V3 swaps.

| Feature            | Detail                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| **buyListingWithETH** | Swaps ETH → exact USDC needed → buys listing → refunds unused ETH     |
| **bidWithETH**     | Swaps ETH → exact USDC needed → places auction bid → refunds unused ETH  |
| **Deadline**       | Both functions require a UNIX timestamp deadline to prevent stale txns    |
| **Pool Fee**       | 0.3% (3000) Uniswap V3 pool fee for ETH/USDC                            |
| **Safety**         | ReentrancyGuard + refund mechanism                                        |

---

## ⚡ Backend API

Powered by **Elysia** running on **Bun**, with **Redis** for caching and **Pinata** for IPFS.

### Key Endpoints

| Method | Route                            | Auth     | Description                                               |
| ------ | -------------------------------- | -------- | --------------------------------------------------------- |
| `GET`  | `/health`                        | —        | Health check (returns chain info)                         |
| `GET`  | `/nft/:tokenId`                  | —        | Token metadata, owner, and active listing status          |
| `GET`  | `/nft/owner/:wallet`             | —        | All tokens owned by a wallet (via The Graph)              |
| `GET`  | `/marketplace/listings`          | —        | Paginated active listings (30s Redis cache, rarity filter, sort) |
| `GET`  | `/marketplace/listings/:tokenId` | —        | Single listing detail (from contract)                     |
| `GET`  | `/marketplace/history/:tokenId`  | —        | Sale history from The Graph                               |
| `POST` | `/marketplace/webhook`           | —        | Invalidate cache on `Listed`/`Sold`/`Cancelled` events    |
| `GET`  | `/auction/active`                | —        | All active (non-finalized) auctions                       |
| `GET`  | `/auction/:auctionId`            | —        | Single auction detail                                     |
| `GET`  | `/auction/:auctionId/bids`       | —        | Bid history for an auction                                |
| `GET`  | `/auction/history/:tokenId`      | —        | All auction bid points for a token                        |
| `POST` | `/auction/:auctionId/finalize`   | —        | Trigger auction finalization (post-deadline)               |
| `POST` | `/admin/mint`                    | Bearer   | Full pipeline: IPFS upload → mint → first-list → create listing |
| `GET`  | `/admin/mint-jobs`               | Bearer   | List all mint jobs with statuses                          |
| `GET`  | `/admin/mint-jobs/:id`           | Bearer   | Single mint job status                                    |

### Services

| Service              | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| **ContractService**  | Reads/writes to all smart contracts via Viem                       |
| **GraphService**     | Queries The Graph subgraph for listings, sales, auctions, bids     |
| **PinataService**    | Uploads NFT images and metadata to IPFS via Pinata                 |
| **Redis**            | Cache layer with pattern-based invalidation                        |

### Security

- **Encrypted Keystore** — The minter wallet private key is stored in a Foundry encrypted keystore (`~/.foundry/keystores/`). Password is prompted interactively at server startup — never stored in plaintext.
- **Bearer Auth** — Admin routes (`/admin/*`) require a bearer token.
- **Game API Secret** — Game bridge endpoints authenticated via `X-Game-Secret` header.

---

## 🖥 Frontend Web App

Built with **Next.js 14** (App Router), **Tailwind CSS**, **Wagmi v2**, and **RainbowKit**.

### Pages

| Route                | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `/`                  | Marketplace grid — browse and filter active NFT listings           |
| `/nft/[tokenId]`     | NFT detail — image, attributes, listing/auction status, price history, buy/list/bid actions |
| `/auction`           | Auction hub — all active auctions with cards                       |
| `/auction/[auctionId]` | Live auction room — countdown, bidding, leaderboard, seller dashboard, pending returns |
| `/profile/[[...wallet]]` | User profile — owned NFTs and activity                         |
| `/admin`             | Admin panel — mint new NFTs (wallet-gated to org address)          |

### Key Components

| Component            | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `PaymentModal`       | 3-option payment selector (USDC / ETH / Card) with step feedback   |
| `AuctionRoom`        | Full auction experience with live countdown, bid form, seller insights |
| `NFTGrid`            | Paginated grid with rarity filtering and sort options              |
| `PriceHistory`       | Recharts line chart for marketplace and auction price history      |
| `ListingForm`        | Create marketplace listing with USDC price input                   |
| `ListingAuction`     | Create auction for MYTHIC NFTs with start price and duration       |
| `BidForm`            | Place bids with USDC or ETH (auto-swap) + minimum bid display      |

### Custom Hooks

| Hook               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `useNFT`           | Fetches token metadata and owner from the API                        |
| `useListing`       | Fetches listing data + handles USDC approval → buy flow              |
| `useAuction`       | Fetches auction details, bids, handles bid/finalize/cancel/withdraw  |
| `useSwapAndBuy`    | 1-transaction ETH purchase via PaymentRouter                         |
| `useTransak`       | Opens Transak fiat onramp widget for credit card USDC purchase       |
| `useUSDC`          | Reads USDC balance and allowance                                     |

---

## 🎮 Game Bridge API

A dedicated set of REST endpoints for mobile game integration. See [GAME_BRIDGE_API.md](GAME_BRIDGE_API.md) for complete documentation.

| Endpoint                  | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `GET /game/regions`       | All regions with NFT status, image URLs, owners      |
| `GET /game/region/:id`    | Single region lookup (tile art for conquest overlay)  |
| `POST /game/conquest`     | Record a user's territory conquest (idempotent)      |
| `GET /game/conquest/:wallet` | All conquests for a wallet (profile/stats)         |

Authentication via `X-Game-Secret` header on all game endpoints.

---

## 🔧 CLI Minting Tool

An interactive terminal tool for admins to mint NFTs from the command line.

```bash
bun run mint
```

**Features:**
- Secure admin token input (masked password prompt)
- Rarity tier selection
- Image encoding (base64) with format validation
- Custom attribute collection
- USDC listing price
- Review summary before submission
- Real-time job status polling with spinner

---

## 🚀 Installation & Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.x
- [Docker](https://www.docker.com/) — for Redis
- [Foundry](https://book.getfoundry.sh/) — for smart contract compilation and testing

### Quick Start

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd fitquest-a
   ```

2. **Install dependencies and start services:**

   ```bash
   bun run setup
   ```

   This installs all Bun packages and starts Redis via Docker Compose.

3. **Configure environment variables:**

   Copy `.env.example` to `.env` in the root and configure:

   | Variable                        | Description                              |
   | ------------------------------- | ---------------------------------------- |
   | `NEXT_PUBLIC_CHAIN_ID`          | Chain ID (84532 for Base Sepolia)        |
   | `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS` | Deployed TerritoryNFT address         |
   | `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS` | Deployed Marketplace address |
   | `NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS` | Deployed Auction address          |
   | `NEXT_PUBLIC_USDC_ADDRESS`      | USDC token address                       |
   | `NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS` | PaymentRouter address               |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID          |
   | `NEXT_PUBLIC_GRAPH_API_URL`     | The Graph subgraph endpoint              |
   | `NEXT_PUBLIC_TRANSAK_API_KEY`   | Transak onramp API key                   |
   | `DATABASE_URL`                  | PostgreSQL connection string             |
   | `PINATA_API_KEY` / `PINATA_SECRET_API_KEY` | Pinata IPFS credentials      |
   | `GAME_API_SECRET`               | Shared secret for game bridge auth       |
   | `BASE_SEPOLIA_RPC_URL`          | Base Sepolia RPC endpoint                |
   | `BASESCAN_API_KEY`              | Basescan verification key                |

4. **Set up the minter keystore:**

   ```bash
   cast wallet import territory-minter --interactive
   ```

5. **Run the development servers:**

   ```bash
   bun run dev
   ```

   This starts both the **Next.js frontend** (`apps/web`) and the **Elysia API** (`apps/api`) via Turborepo.

### Available Scripts

| Script                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `bun run setup`        | Install deps + start Docker services             |
| `bun run dev`          | Start all dev servers (API + Web)                |
| `bun run dev:api`      | Start only the API server                        |
| `bun run dev:web`      | Start only the web frontend                      |
| `bun run build`        | Production build all packages                    |
| `bun run lint`         | Lint all packages                                |
| `bun run type-check`   | TypeScript type checking                         |
| `bun run format`       | Prettier formatting                              |
| `bun run mint`         | Launch CLI minting tool                          |
| `bun run services:up`  | Start Docker services (Redis)                    |
| `bun run services:down`| Stop Docker services                             |
| `bun run services:reset` | Reset Docker volumes and restart               |

---

## 🧪 Testing

### Smart Contracts (Foundry)

The contracts have **51 tests** covering core functionality, edge cases, gas baselines, and fuzz testing.

```bash
cd packages/contracts

# Run all tests
forge test

# Run with verbose traces
forge test -vvv

# Run a specific test
forge test --match-test testBuyListingTransfersNFTAndFunds -vvv

# Update gas snapshots
forge snapshot
```

**Test coverage includes:**
- NFT minting, transfer guards, and role permissions
- Marketplace: listing, buying, cancelling, royalty distribution, royalty cap (15%)
- Auction: bidding, increment enforcement, anti-sniping extension, finalization, pending returns
- Payment Router: ETH→USDC swap + buy, ETH→USDC swap + bid, deadline enforcement
- Gas baselines for all critical operations

### TypeScript

```bash
# Type-check all packages
bun run type-check

# Lint all packages
bun run lint
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on our development workflow, testing requirements, and pull request process.

**Stack overview:**
- Backend API: Elysia, Bun, Redis, Viem
- Frontend: Next.js 14, Tailwind CSS, Wagmi, RainbowKit
- Smart Contracts: Solidity ^0.8.24, Foundry

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
