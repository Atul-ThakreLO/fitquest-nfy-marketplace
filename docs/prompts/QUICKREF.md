# Territory NFT — Quick Reference & Execution Order

## How to use these prompts in Cursor

1. Open the monorepo root in Cursor
2. Pin `00-MASTER-PROMPT.md` as always-visible context (use Cursor's "Add to context" feature)
3. Open each numbered prompt as a new Cursor Composer session
4. Work through them in order — each builds on the last

---

## Execution Order

```
01  → Scaffold monorepo, shared types, shared ABIs placeholder
02  → Write + test all 3 Solidity contracts, deploy to Base Sepolia
        └─ After deploy: run `bun run sync-abis` to populate shared ABIs
03  → Set up The Graph subgraph, deploy to hosted service
04  → Build Bun + Elysia backend API, Prisma schema, all services
05  → Build Next.js marketplace frontend
06  → Build admin panel (included in prompt 05, app/admin/)
07  → Generate game bridge docs (included in 03-and-07 file)
```

---

## Key Decisions Summary

| Decision | Choice | Why |
|---|---|---|
| L2 chain | Base (Sepolia testnet) | Low gas, EVM-compatible, ERC-4337 ready |
| Contract framework | Foundry + OZ 5.x | You already use Foundry (cast etc.) |
| Backend runtime | Bun + Elysia | Type-safe, fast, less boilerplate, Cursor debugs well |
| Wallet UX | RainbowKit + Wagmi v2 | Best DX, handles all wallet providers, well-typed |
| Contract reads/writes | Viem | Type-safe, tree-shakeable, works natively with Wagmi v2 |
| NFT storage | Pinata (official SDK) | Reliable pinning, fast gateway, good DX |
| Event indexing | The Graph | No polling, GraphQL queries, pagination built-in |
| DB ORM | Prisma | Type-safe, migrations, works perfectly with Bun |
| Monorepo | Turborepo | Shared types, ABI sync between contracts and frontend |

---

## Game ↔ Marketplace Link (Critical)

```
Mobile Game                     Our Backend (api)
     │                               │
     │  POST /game/conquest          │
     │  (walk verified)              │
     │──────────────────────────────►│
     │                               │── record in DB
     │                               │── look up region.nftTokenId
     │  ◄── { imageUrl, tokenId } ───│
     │                               │
     │  Renders NFT as tile art      │
     │  Links to marketplace URL     │
                                     │
                              User opens web marketplace
                              → buys / bids on NFT
                              → wallet gets ownership
```

The game team only needs:
- `X-Game-Secret` env var (we provide)
- Our API base URL
- Docs from `GAME_BRIDGE_API.md`

They do NOT need wallet addresses, contract addresses, or any blockchain knowledge.

---

## Environment Setup Checklist

```bash
# Base Sepolia RPC (free from Alchemy or Coinbase)
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Pinata (get from app.pinata.cloud)
PINATA_API_KEY=
PINATA_SECRET_API_KEY=

# WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Basescan (for contract verification, get from basescan.org)
BASESCAN_API_KEY=

# These get filled after deploy (prompt 02)
NFT_CONTRACT_ADDRESS=
MARKETPLACE_CONTRACT_ADDRESS=
AUCTION_CONTRACT_ADDRESS=

# Gnosis Safe (create at app.safe.global, Base Sepolia)
ADMIN_ADDRESS=        # Safe address
ORG_TREASURY_ADDRESS= # Safe address (same or different)

# Hot wallet for minting (generate a fresh one, fund with Sepolia ETH)
MINTER_ADDRESS=
MINTER_PRIVATE_KEY=

# Random string, share with game team
GAME_API_SECRET=
```
