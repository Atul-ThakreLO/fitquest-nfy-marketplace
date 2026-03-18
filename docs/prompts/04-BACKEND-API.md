# Prompt 04 — Backend API (Bun + Elysia)

> **Cursor instruction**: Build the complete backend inside `apps/api/`. Use Elysia's built-in features for validation, routing, and OpenAPI docs. Use Prisma for DB. Use the official Pinata SDK. Do not write raw SQL — use Prisma ORM exclusively.

---

## Final Folder Structure

```
apps/api/
├── src/
│   ├── index.ts                  # App entry point
│   ├── config.ts                 # Typed env config
│   ├── db/
│   │   └── prisma.ts             # Prisma singleton
│   ├── routes/
│   │   ├── nft.ts                # NFT metadata queries
│   │   ├── marketplace.ts        # Listing queries (cached from Graph)
│   │   ├── auction.ts            # Auction queries + finalize trigger
│   │   ├── mint.ts               # Org mint orchestration (protected)
│   │   ├── game-bridge.ts        # Endpoints for the mobile game team
│   │   └── admin.ts              # Admin only routes
│   ├── services/
│   │   ├── pinata.service.ts     # Upload art + metadata to IPFS
│   │   ├── contract.service.ts   # Viem read/write calls
│   │   ├── graph.service.ts      # The Graph query service
│   │   └── conquest.service.ts   # Walk verification + NFT reveal logic
│   ├── middleware/
│   │   ├── auth.ts               # Bearer token for org routes
│   │   └── game-auth.ts          # Shared secret for game bridge
│   └── lib/
│       └── viem.ts               # Viem publicClient + walletClient setup
├── prisma/
│   └── schema.prisma
├── .env
├── package.json
└── tsconfig.json
```

---

## Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  walletAddress String   @unique
  username      String?
  createdAt     DateTime @default(now())
  conquests     Conquest[]
}

model Region {
  id            Int       @id
  name          String
  element       String    // fire | ice | forest | urban | coastal | storm
  difficulty    Int
  nftTokenId    BigInt?   // null until minted
  ipfsCID       String?
  imageUrl      String?
  isConquerable Boolean   @default(true)
  conquests     Conquest[]
}

model Conquest {
  id            String   @id @default(cuid())
  user          User     @relation(fields: [walletAddress], references: [walletAddress])
  walletAddress String
  region        Region   @relation(fields: [regionId], references: [id])
  regionId      Int
  stepCount     Int
  gameSessionId String   @unique    // idempotency key
  conqueredAt   DateTime @default(now())

  @@index([walletAddress])
  @@index([regionId])
}

model MintJob {
  id          String   @id @default(cuid())
  regionId    Int      @unique
  rarity      Int      // Rarity enum value
  status      String   @default("pending")   // pending | uploading | minting | done | failed
  pinataCID   String?
  txHash      String?
  tokenId     BigInt?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## `src/config.ts`

```typescript
const config = {
  port: Number(Bun.env.PORT ?? 3001),
  databaseUrl: Bun.env.DATABASE_URL!,
  minterPrivateKey: Bun.env.MINTER_PRIVATE_KEY as `0x${string}`,
  pinataApiKey: Bun.env.PINATA_API_KEY!,
  pinataSecretApiKey: Bun.env.PINATA_SECRET_API_KEY!,
  pinataGateway: Bun.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud",
  gameApiSecret: Bun.env.GAME_API_SECRET!,
  nftContractAddress: Bun.env.NFT_CONTRACT_ADDRESS as `0x${string}`,
  marketplaceContractAddress: Bun.env
    .MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auctionContractAddress: Bun.env.AUCTION_CONTRACT_ADDRESS as `0x${string}`,
  graphApiUrl: Bun.env.GRAPH_API_URL!,
  chainId: 84532, // Base Sepolia
} as const;

// Validate all required vars at startup
const required = [
  "DATABASE_URL",
  "MINTER_PRIVATE_KEY",
  "PINATA_API_KEY",
  "PINATA_SECRET_API_KEY",
  "GAME_API_SECRET",
  "NFT_CONTRACT_ADDRESS",
  "MARKETPLACE_CONTRACT_ADDRESS",
  "AUCTION_CONTRACT_ADDRESS",
  "GRAPH_API_URL",
];
for (const key of required) {
  if (!Bun.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export default config;
```

---

## `src/lib/viem.ts`

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import config from "../config";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export const minterAccount = privateKeyToAccount(config.minterPrivateKey);

export const walletClient = createWalletClient({
  account: minterAccount,
  chain: baseSepolia,
  transport: http(),
});
```

---

## `src/services/pinata.service.ts`

Use the `pinata` npm package (official SDK). Implement:

```typescript
import { PinataSDK } from "pinata";
import type { NFTMetadata } from "territory-nft-shared";

class PinataService {
  private sdk: PinataSDK;

  constructor() {
    this.sdk = new PinataSDK({
      pinataJwt: `${config.pinataApiKey}:${config.pinataSecretApiKey}`,
      pinataGateway: config.pinataGateway,
    });
  }

  // Upload image file (Buffer or Blob) → returns CID
  async uploadImage(imageBuffer: Buffer, filename: string): Promise<string>;

  // Upload metadata JSON → returns CID
  async uploadMetadata(metadata: NFTMetadata): Promise<string>;

  // Upload both as a folder → returns folder CID
  // Structure: {CID}/image.png and {CID}/metadata.json
  async uploadNFTAssets(
    imageBuffer: Buffer,
    metadata: Omit<NFTMetadata, "image">,
  ): Promise<{ folderCID: string; imageUrl: string; metadataUrl: string }>;

  // Returns public gateway URL for a CID
  getGatewayUrl(cid: string, path?: string): string;
}
```

The `uploadNFTAssets` method should:

1. Upload image first → get imageCID
2. Construct full metadata object with `image: "ipfs://${imageCID}"`
3. Upload metadata JSON → get metadataCID
4. Return both CIDs and the resolved gateway URLs

---

## `src/services/contract.service.ts`

Import ABIs from `territory-nft-shared`. Use Viem's `readContract` and `writeContract`. Implement:

```typescript
import { publicClient, walletClient, minterAccount } from "../lib/viem";
import TerritoryNFTAbi from "territory-nft-shared/abis/TerritoryNFT.json";
import TerritoryMarketplaceAbi from "territory-nft-shared/abis/TerritoryMarketplace.json";
import TerritoryAuctionAbi from "territory-nft-shared/abis/TerritoryAuction.json";
import type { Rarity, TokenInfo, Listing, Auction } from "territory-nft-shared";

class ContractService {
  // NFT reads
  async getTokenData(tokenId: bigint): Promise<TokenInfo>;
  async getTokenByRegion(regionId: number): Promise<bigint>;
  async ownerOf(tokenId: bigint): Promise<`0x${string}`>;

  // NFT writes (minter wallet)
  async mintToken(
    to: `0x${string}`,
    rarity: Rarity,
    regionId: number,
    ipfsCID: string,
  ): Promise<`0x${string}`>; // returns txHash
  async markFirstListed(tokenId: bigint): Promise<`0x${string}`>;

  // Marketplace reads
  async getListing(tokenId: bigint): Promise<Listing>;

  // Auction reads
  async getAuction(auctionId: bigint): Promise<Auction>;

  // Wait for tx receipt and return it
  async waitForTransaction(txHash: `0x${string}`);
}
```

---

## `src/services/graph.service.ts`

Query The Graph subgraph. Use native `fetch`. Implement GraphQL queries for:

```typescript
class GraphService {
  // Get all active listings (paginated)
  async getActiveListings(skip: number, take: number): Promise<Listing[]>;

  // Get listing history for a token
  async getTokenHistory(tokenId: bigint): Promise<
    Array<{
      event: "Listed" | "Sold" | "Cancelled";
      price: bigint;
      from: string;
      to?: string;
      timestamp: number;
    }>
  >;

  // Get active auctions
  async getActiveAuctions(): Promise<Auction[]>;

  // Get all bids for an auction
  async getAuctionBids(auctionId: bigint): Promise<Bid[]>;

  // Get tokens owned by wallet
  async getTokensByOwner(walletAddress: string): Promise<bigint[]>;
}
```

---

## Route: `src/routes/game-bridge.ts`

These are the endpoints consumed by the mobile game team.

**Authentication**: `X-Game-Secret` header must match `GAME_API_SECRET` env var.

```
GET  /game/regions              → list all regions with NFT status
GET  /game/region/:id           → get single region + NFT image URL
POST /game/conquest             → record a walk conquest
GET  /game/conquest/:wallet     → get all conquests for a wallet
```

### `POST /game/conquest` body:

```typescript
{
  regionId: number;
  walletAddress: string; // `0x${string}`
  stepCount: number;
  gameSessionId: string; // idempotency key
}
```

**Conquest logic in `conquest.service.ts`**:

1. Check `gameSessionId` is not duplicate (idempotent)
2. Look up region in DB
3. Record conquest in DB
4. If region has `nftTokenId`: check if `ownerOf(tokenId) === walletAddress`. If not, this is informational only — the conquest is recorded but NFT is not transferred (user must buy it on marketplace)
5. Return region info including NFT imageUrl if available

> **Note to Cursor**: The game team records the walk. Our system records the conquest. NFT ownership is separate — users must purchase/win NFTs on the marketplace. Conquest history is stored offchain; NFT ownership is onchain.

---

## Route: `src/routes/mint.ts`

Protected by org Bearer token.

```
POST /admin/mint           → full mint pipeline
GET  /admin/mint-jobs      → list mint jobs with status
GET  /admin/mint-jobs/:id  → single mint job status
```

### `POST /admin/mint` body:

```typescript
{
  regionId: number;
  rarity: 0 | 1 | 2 | 3 | 4;
  minterAddress: string; // org wallet initially
  imageBase64: string; // the NFT artwork as base64 PNG
  name: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  listPrice: string; // in ETH, e.g. "0.05"
}
```

### Pipeline inside the handler:

1. Create `MintJob` in DB with status `pending`
2. Decode base64 → Buffer
3. Call `pinataService.uploadNFTAssets(buffer, metadata)` → `folderCID`
4. Update MintJob: status `minting`, `pinataCID = folderCID`
5. Call `contractService.mintToken(recipient, rarity, regionId, folderCID)`
6. Await tx → get `tokenId`
7. Update MintJob: status `done`, `txHash`, `tokenId`
8. Update `Region` in DB: `nftTokenId`, `ipfsCID`, `imageUrl`
9. Call `contractService.markFirstListed(tokenId)`
10. Create marketplace listing via contract write
11. Return `{ success: true, tokenId, txHash, imageUrl }`

Handle each step with try/catch and update MintJob status to `failed` on error with error message stored.

---

## Route: `src/routes/nft.ts`

Public endpoints.

```
GET /nft/:tokenId           → token metadata + owner + listing status
GET /nft/region/:regionId   → get token by region
GET /nft/owner/:wallet      → all tokens owned by wallet
```

---

## Route: `src/routes/marketplace.ts`

```
GET /marketplace/listings           → all active listings (paginated)
GET /marketplace/listings/:tokenId  → single listing
GET /marketplace/history/:tokenId   → sale history from The Graph
```

---

## Route: `src/routes/auction.ts`

```
GET /auction/active                  → all active auctions
GET /auction/:auctionId              → single auction detail
GET /auction/:auctionId/bids         → bid history
POST /auction/:auctionId/finalize    → trigger finalization (callable by anyone post-deadline)
```

The `finalize` endpoint calls `contractService.finalizeAuction(auctionId)` from the minter wallet (anyone can pay the gas to finalize, we do it as a service).

---

## `src/index.ts` (full app assembly)

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { bearer } from "@elysiajs/bearer";
import { nftRoutes } from "./routes/nft";
import { marketplaceRoutes } from "./routes/marketplace";
import { auctionRoutes } from "./routes/auction";
import { mintRoutes } from "./routes/mint";
import { gameBridgeRoutes } from "./routes/game-bridge";
import config from "./config";

const app = new Elysia()
  .use(cors({ origin: true }))
  .use(bearer())
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: { title: "Territory NFT API", version: "1.0.0" },
      },
    }),
  )
  .get("/health", () => ({ status: "ok", chain: "base-sepolia" }))
  .use(nftRoutes)
  .use(marketplaceRoutes)
  .use(auctionRoutes)
  .use(mintRoutes)
  .use(gameBridgeRoutes)
  .listen(config.port);

console.log(`API at http://localhost:${config.port}`);
console.log(`Docs at http://localhost:${config.port}/docs`);

export type App = typeof app;
```

---

## Error Handling Convention

All routes use Elysia's `error` plugin pattern:

```typescript
.onError(({ error, code }) => {
  if (code === 'NOT_FOUND') return { success: false, message: 'Not found' }
  console.error(error)
  return { success: false, message: 'Internal server error' }
})
```

All successful responses: `{ success: true, data: ... }`
All error responses: `{ success: false, message: string }`
