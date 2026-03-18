# Territory NFT Marketplace

A complete Web3 DApp for minting, trading, and auctioning Territory NFTs on the Base network. Built with a modern monorepo architecture, it features a Next.js frontend, an Elysia-powered backend API with Redis caching, and robust Foundry-tested smart contracts.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Backend API](#backend-api)
- [Frontend Web App](#frontend-web-app)
- [Installation & Setup](#installation--setup)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Overview

Territory NFT Marketplace is an end-to-end decentralized application that digitizes geographic regions into unique, tradable assets. Built for scalability, the platform empowers administrators to seamlessly mint new territorial tiles on the Base blockchain as ERC-721 tokens, complete with IPFS-hosted metadata. Through an intuitive web portal, everyday users can securely connect their Web3 wallets to browse active listings, purchase regular tiles at fixed prices, or participate in competitive English-style auctions for exclusive `MYTHIC`-tier regional tiles.

**Token Characteristics:**
- **Standard**: ERC-721
- **Network**: Base (Sepolia for testing)
- **Rarity System**: `COMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHIC`
- **Royalties**: 5% protocol royalty embedded (ERC-2981)

## Architecture

This project is built as a Turborepo monorepo using Bun, separated into independent applications and packages.

```text
┌─────────────────────────────────────────────────────────────┐
│                 Web Marketplace (Next.js 14)                │
│       (Wagmi + RainbowKit, React Query, Tailwind CSS)       │
└────────────────┬─────────────────────────────┬──────────────┘
                 │                             │
    HTTP / REST  │                             │  Web3 RPC
                 ▼                             │
┌────────────────────────────────────┐         │
│         Backend API (Elysia)       │         │
│(Redis for cache, Pinata for IPFS)  │         │
└────────────────┬───────────────────┘         │
                 │                             │
                 ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Smart Contracts (Foundry)                  │
│       (TerritoryNFT, Marketplace, Auction on Base)          │
└─────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

- `apps/api`: High-performance backend API written in Elysia. Handles IPFS uploads, Redis caching for marketplace listings, and interacts with Web3 using Viem/Ethers.
- `apps/web`: The Next.js 14 frontend application featuring pages for the gallery, auctions, user profiles, and an admin dashboard.
- `packages/contracts`: Foundry project containing all Solidity smart contracts.
- `packages/subgraph` & `packages/config` / `packages/shared`: Shared configurations, The Graph indexing files, and TypeScript types.

## Smart Contracts

The smart contracts are written in Solidity `^0.8.24` and leverage OpenZeppelin standards.

### 1. TerritoryNFT.sol
The core ERC-721 token representing geographic regions.
- **Minting**: Restricted to the `MINTER_ROLE`.
- **First-Listing Lock**: Transfers are locked until the organization performs the initial listing (`firstListed` flag), ensuring a controlled primary market.
- **Metadata**: IPFS CIDs are natively stored on-chain.

### 2. TerritoryMarketplace.sol
A decentralized fixed-price trading platform.
- **Listings**: Users (and the org) can create, update, and cancel fixed-price listings.
- **Purchasing**: Executes atomic NFT swaps and ETH transfers.
- **Royalties**: Automatically calculates and distributes the 5% ERC-2981 royalty upon sale.

### 3. TerritoryAuction.sol
An English-style auction contract exclusively for `MYTHIC` tier NFTs.
- **Bidding Rules**: Includes a 5% minimum bid increment.
- **Anti-Sniping**: Automatically extends the auction by 10 minutes if a bid is placed in the final 10 minutes.
- **Escrow & Refunds**: Securely tracks outbid amounts as pending returns for safe withdrawal by participants.

## Backend API

The backend API is powered by **Elysia** and running on **Bun**. It connects to **Postgres** and **Redis** (via Docker) to serve fast marketplace data.

**Key Routes:**
- `POST /admin/mint`: Full pipeline to upload images to IPFS (via Pinata), mint the NFT on-chain, and automatically list it on the marketplace.
- `GET /marketplace/listings`: Retrieves paginated active marketplace listings, powered by a 30-second Redis cache.
- `POST /marketplace/webhook`: Invalidates Redis caches upon `Listed`, `Sold`, or `Cancelled` smart contract events.
- `GET /nft/:tokenId` & `GET /nft/owner/:wallet`: Fetches metadata and ownership details by querying the contract and The Graph.
- `/auction/*`: Operations to fetch active and historical auction data.

## Frontend Web App

Built with **Next.js 14**, the web client offers a premium user experience:
- **Wallet Connection**: Integrated with Wagmi and RainbowKit.
- **Pages**:
  - `/`: Main marketplace grid.
  - `/nft/:id`: Individual NFT details page.
  - `/profile`: User's owned NFTs and past activity.
  - `/auction`: Active and past auctions.
  - `/admin`: Dashboard for admins to mint and list new tiles.

## Installation & Setup

### Prerequisites
- [Bun](https://bun.sh/) (v1.x)
- [Docker](https://www.docker.com/) (Required for Postgres and Redis)
- [Foundry](https://book.getfoundry.sh/) (Required for smart contract compilation and testing)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd fitquest-a
   ```

2. **Install dependencies and start services:**
   The `setup` script will install Bun packages and spin up PostgreSQL and Redis via Docker Compose.
   ```bash
   bun run setup
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` in the root and configure necessary keys:
   - Base Sepolia RPC URLs
   - Pinata JWT (for IPFS uploads)
   - Database / Redis connection strings
   - Encrypted Keystore configurations (for admin wallet interactions)

4. **Run the Development Servers:**
   ```bash
   bun run dev
   ```
   *This starts both the Next.js frontend (`apps/web`) and the Elysia API (`apps/api`).*

## Testing

The smart contracts are rigorously tested using Foundry's integrated testing environment.

```bash
cd packages/contracts

# Run all tests
forge test

# Run tests with detailed traces
forge test -vvv
```

## Contributing

We welcome contributions from the community! Whether it's fixing bugs, improving documentation, or proposing new features, your help is highly appreciated. Please see our [Contributing Guidelines](CONTRIBUTING.md) to learn how to set up your local development environment, run our tests, and submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
