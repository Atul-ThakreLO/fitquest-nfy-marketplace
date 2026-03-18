# Prompt 06 — Remove Region & Game Logic (Full Cleanup)

> **Antigravity instruction**: The project needs a focused cleanup. We are removing all region-specific logic, game bridge logic, conquest logic, and the database entirely from the backend. The backend's only job is: serve as a bridge between the frontend and The Graph/blockchain — Pinata uploads, contract orchestration for minting, and Graph queries. Apply every change listed below precisely. Do not remove anything else.

---

## What gets removed vs what stays

```
REMOVE:
  - regionId from contracts, types, ABIs, everything
  - regionToToken mapping and uniqueness check in TerritoryNFT.sol
  - getTokenByRegion() function
  - TokenMinted event's regionId parameter
  - game-bridge.ts route (entire file)
  - conquest.service.ts (entire file)
  - game-auth.ts middleware (entire file)
  - Prisma / PostgreSQL / Docker entirely
  - Region, Conquest, User models
  - MintJob.regionId field
  - api.nft.getByRegion() in frontend
  - Conquest history section in profile page
  - Region ID field in admin mint form
  - GAME_API_SECRET env var everywhere

KEEP (do not touch):
  - All three contracts structure
  - Rarity enum and all rarity logic
  - firstListed flag and transfer guard
  - Royalties (ERC-2981)
  - MintJob tracking (keep but simplified — no regionId)
  - Pinata service
  - graph.service.ts
  - contract.service.ts
  - All marketplace routes
  - All auction routes
  - nft.ts route (minus getByRegion)
  - mint.ts route (minus regionId)
  - Full frontend marketplace, auction, profile pages
  - Admin panel (minus region ID field)
  - RainbowKit, Wagmi, Viem setup
  - Redis caching (keep — still useful for Graph query caching)
  - Docker (keep — Redis still runs in Docker, Postgres removed)
```

---

## 1. `packages/contracts/src/TerritoryNFT.sol`

### Remove from struct:

```solidity
// REMOVE this field from TokenData struct:
uint16 regionId;
```

### Remove mapping and uniqueness check:

```solidity
// REMOVE entirely:
mapping(uint16 => uint256) public regionToToken;

// REMOVE from safeMint():
require(regionToToken[regionId] == 0, "Region already has token");
regionToToken[regionId] = tokenId;
```

### Update safeMint signature — remove regionId parameter:

```solidity
// BEFORE:
function safeMint(address to, Rarity rarity, uint16 regionId, string calldata ipfsCID)

// AFTER:
function safeMint(address to, Rarity rarity, string calldata ipfsCID)
```

### Update TokenMinted event — remove regionId:

```solidity
// BEFORE:
event TokenMinted(uint256 indexed tokenId, address indexed owner, Rarity rarity, uint16 regionId);

// AFTER:
event TokenMinted(uint256 indexed tokenId, address indexed owner, Rarity rarity);
```

### Remove getTokenByRegion function entirely:

```solidity
// REMOVE this entire function:
function getTokenByRegion(uint16 regionId) external view returns (uint256) { ... }
```

### Final TokenData struct should be:

```solidity
struct TokenData {
    Rarity rarity;
    string ipfsCID;
    bool   firstListed;
}
```

---

## 2. `packages/contracts/test/TerritoryNFT.t.sol`

Remove this test entirely:

```solidity
// REMOVE:
function testOneTokenPerRegion() { ... }
```

Update all `safeMint()` calls in tests — remove the `regionId` argument:

```solidity
// BEFORE:
nft.safeMint(user, Rarity.COMMON, 1, "QmTest");

// AFTER:
nft.safeMint(user, Rarity.COMMON, "QmTest");
```

---

## 3. `packages/contracts/script/Deploy.s.sol`

No changes needed here — constructor parameters haven't changed.

---

## 4. After contract changes — recompile and sync ABIs

```bash
cd packages/contracts
forge build

cd packages/shared
bun run sync-abis
```

The updated ABIs (without regionId) will flow automatically to backend and frontend.

---

## 5. `packages/shared/src/types/nft.ts`

### Update TokenInfo type — remove regionId:

```typescript
// BEFORE:
export interface TokenInfo {
  tokenId: bigint;
  rarity: Rarity;
  regionId: number;
  ipfsCID: string;
  firstListed: boolean;
  owner: `0x${string}`;
}

// AFTER:
export interface TokenInfo {
  tokenId: bigint;
  rarity: Rarity;
  ipfsCID: string;
  firstListed: boolean;
  owner: `0x${string}`;
}
```

### Remove Region type entirely:

```typescript
// REMOVE the entire Region interface and ConquestPayload interface from types/region.ts
// DELETE the file: packages/shared/src/types/region.ts
```

### Update barrel export in `packages/shared/src/types/index.ts`:

```typescript
// REMOVE:
export * from "./region";
```

---

## 6. Backend — `apps/api/`

### Delete these files entirely:

```
apps/api/src/routes/game-bridge.ts       DELETE
apps/api/src/services/conquest.service.ts  DELETE
apps/api/src/middleware/game-auth.ts     DELETE
apps/api/prisma/                         DELETE entire folder
apps/api/src/db/                         DELETE entire folder
```

### Remove Prisma dependency:

```bash
cd apps/api
bun remove @prisma/client prisma
```

### Update `apps/api/src/config.ts` — remove game secret, remove database URL:

```typescript
// REMOVE these fields:
// gameApiSecret: Bun.env.GAME_API_SECRET!,
// databaseUrl: Bun.env.DATABASE_URL!,

// REMOVE from required array:
// 'DATABASE_URL', 'GAME_API_SECRET'

// Final config should be:
const config = {
  port: Number(Bun.env.PORT ?? 3001),
  keystoreName: Bun.env.KEYSTORE_NAME ?? "minter",
  pinataApiKey: Bun.env.PINATA_API_KEY!,
  pinataSecretApiKey: Bun.env.PINATA_SECRET_API_KEY!,
  pinataGateway: Bun.env.PINATA_GATEWAY_URL ?? "https://gateway.pinata.cloud",
  nftContractAddress: Bun.env.NFT_CONTRACT_ADDRESS as `0x${string}`,
  marketplaceContractAddress: Bun.env
    .MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auctionContractAddress: Bun.env.AUCTION_CONTRACT_ADDRESS as `0x${string}`,
  graphApiUrl: Bun.env.GRAPH_API_URL!,
  redisUrl: Bun.env.REDIS_URL ?? "redis://localhost:6379",
  chainId: 84532,
} as const;

const required = [
  "PINATA_API_KEY",
  "PINATA_SECRET_API_KEY",
  "NFT_CONTRACT_ADDRESS",
  "MARKETPLACE_CONTRACT_ADDRESS",
  "AUCTION_CONTRACT_ADDRESS",
  "GRAPH_API_URL",
];
```

### Update `apps/api/src/services/contract.service.ts` — remove regionId from mintToken:

```typescript
// BEFORE:
async mintToken(to: `0x${string}`, rarity: Rarity, regionId: number, ipfsCID: string): Promise<`0x${string}`>

// AFTER:
async mintToken(to: `0x${string}`, rarity: Rarity, ipfsCID: string): Promise<`0x${string}`>

// Update the actual writeContract call inside:
// BEFORE:
this.nft.write.safeMint([to, rarity, regionId, ipfsCID])

// AFTER:
this.nft.write.safeMint([to, rarity, ipfsCID])

// REMOVE this method entirely:
// async getTokenByRegion(regionId: number): Promise<bigint>
```

### Update `apps/api/src/routes/mint.ts` — remove regionId from request body and pipeline:

```typescript
// REMOVE from request body validation:
// regionId: t.Number(),

// REMOVE from pipeline:
// Step 5 was: contractService.mintToken(recipient, rarity, regionId, folderCID)
// NOW:        contractService.mintToken(recipient, rarity, folderCID)

// REMOVE from MintJob create:
// regionId field

// Final mint request body type:
{
  rarity: 0 | 1 | 2 | 3 | 4;
  minterAddress: string;
  imageBase64: string;
  name: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  listPrice: string;
}
```

### Update `apps/api/src/routes/nft.ts` — remove getByRegion endpoint:

```typescript
// REMOVE this route entirely:
// GET /nft/region/:regionId
```

### Update `apps/api/src/index.ts` — remove game bridge import and usage:

```typescript
// REMOVE:
// import { gameBridgeRoutes } from './routes/game-bridge'
// .use(gameBridgeRoutes)

// Final app assembly only uses:
// nftRoutes, marketplaceRoutes, auctionRoutes, mintRoutes
```

### Update MintJob model — since we removed Prisma, MintJob tracking moves to in-memory Map:

Since we no longer have Postgres, replace `MintJob` DB tracking with a simple in-memory Map in `mint.ts`. Jobs are lost on restart which is fine for now — the blockchain is the source of truth:

```typescript
// In apps/api/src/routes/mint.ts, add at top of file:
const mintJobs = new Map<
  string,
  {
    id: string;
    status: "pending" | "uploading" | "minting" | "done" | "failed";
    rarity: number;
    pinataCID?: string;
    txHash?: string;
    tokenId?: string;
    error?: string;
    createdAt: Date;
  }
>();
```

`GET /admin/mint-jobs` and `GET /admin/mint-jobs/:id` read from this Map instead of Prisma.

---

## 7. `apps/api/.env` — remove DB and game secret

```env
# ── Redis (keep — used for Graph query caching) ────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Keystore ───────────────────────────────────────────────────────────────
KEYSTORE_NAME=lg_main

# ── Contracts ──────────────────────────────────────────────────────────────
NFT_CONTRACT_ADDRESS=
MARKETPLACE_CONTRACT_ADDRESS=
AUCTION_CONTRACT_ADDRESS=

# ── Pinata ─────────────────────────────────────────────────────────────────
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
PINATA_GATEWAY_URL=https://gateway.pinata.cloud

# ── The Graph ──────────────────────────────────────────────────────────────
GRAPH_API_URL=
```

`DATABASE_URL` and `GAME_API_SECRET` are gone.

---

## 8. `docker-compose.dev.yml` — remove Postgres service

Keep Redis, remove Postgres entirely:

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    container_name: territory_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

---

## 9. Root `package.json` scripts — remove DB scripts

```json
// REMOVE these scripts:
// "db:migrate"
// "db:migrate:prod"
// "db:reset"
// "db:studio"
// "db:generate"

// UPDATE setup script — no longer needs db steps:
"setup": "bun install && bun run services:up",

// UPDATE dev script — same as before:
"dev": "bun run services:up && turbo run dev",
```

---

## 10. `packages/subgraph/schema.graphql` — remove regionId from Token entity

```graphql
# BEFORE:
type Token @entity {
  id: ID!
  owner: String!
  rarity: Int!
  regionId: Int!
  ipfsCID: String!
  firstListed: Boolean!
  listings: [Listing!]! @derivedFrom(field: "token")
  auctions: [Auction!]! @derivedFrom(field: "token")
}

# AFTER:
type Token @entity {
  id: ID!
  owner: String!
  rarity: Int!
  ipfsCID: String!
  firstListed: Boolean!
  listings: [Listing!]! @derivedFrom(field: "token")
  auctions: [Auction!]! @derivedFrom(field: "token")
}
```

---

## 11. `packages/subgraph/src/mapping.ts` — remove regionId from TokenMinted handler

```typescript
// BEFORE:
export function handleTokenMinted(event: TokenMinted): void {
  let token = new Token(event.params.tokenId.toString());
  token.owner = event.params.owner.toHexString();
  token.rarity = event.params.rarity;
  token.regionId = event.params.regionId; // REMOVE this line
  token.ipfsCID = "";
  token.firstListed = false;
  token.save();
}

// AFTER:
export function handleTokenMinted(event: TokenMinted): void {
  let token = new Token(event.params.tokenId.toString());
  token.owner = event.params.owner.toHexString();
  token.rarity = event.params.rarity;
  token.ipfsCID = "";
  token.firstListed = false;
  token.save();
}
```

---

## 12. `packages/subgraph/subgraph.yaml` — update TokenMinted event signature

```yaml
# BEFORE:
- event: TokenMinted(indexed uint256,indexed address,uint8,uint16)

# AFTER:
- event: TokenMinted(indexed uint256,indexed address,uint8)
```

---

## 13. Frontend — `apps/web/src/lib/api.ts`

Remove `getByRegion`:

```typescript
// REMOVE from api.nft:
// getByRegion: (regionId: number) => apiFetch<TokenInfo>(`/nft/region/${regionId}`),

// Final api.nft:
nft: {
  getByTokenId: (tokenId: string) =>
    apiFetch<TokenInfo>(`/nft/${tokenId}`),
  getByOwner: (wallet: string) =>
    apiFetch<TokenInfo[]>(`/nft/owner/${wallet}`),
},
```

---

## 14. Frontend — `apps/web/src/app/profile/[wallet]/page.tsx`

Remove conquest history section:

```typescript
// REMOVE the conquest history timeline section entirely
// REMOVE any import or usage of api.game or conquest-related calls

// Keep:
// - Wallet address + ENS name
// - Grid of owned NFTs
// - My Active Listings section
```

---

## 15. Frontend — `apps/web/src/app/admin/page.tsx`

Remove region ID field from mint form:

```typescript
// REMOVE from form fields:
// - Region ID (number) input field
// - Any regionId state variable
// - regionId from the POST body sent to /admin/mint
```

---

## 16. Contract redeployment (do this FIRST)

Contracts must be deployed before the subgraph because the subgraph needs the new contract address to watch.

```bash
cd packages/contracts
forge build
forge test        # all tests must pass before deploying
```

Then deploy. Foundry will prompt for your keystore password in the terminal — type it when asked:

```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --account lg_main \
  --broadcast \
  --verify \
  -vvvv
```

The terminal will output three new contract addresses:

```
TerritoryNFT:          0x...
TerritoryMarketplace:  0x...
TerritoryAuction:      0x...
```

Immediately update both env files with these addresses:

- `apps/api/.env` → `NFT_CONTRACT_ADDRESS`, `MARKETPLACE_CONTRACT_ADDRESS`, `AUCTION_CONTRACT_ADDRESS`
- `apps/web/.env.local` → `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`, `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS`, `NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS`

Then sync the updated ABIs to the shared package:

```bash
cd packages/shared
bun run sync-abis
```

Also copy the updated ABI directly into the subgraph package (it has its own copy):

```bash
cp packages/contracts/out/TerritoryNFT.sol/TerritoryNFT.json packages/subgraph/abis/TerritoryNFT.json
```

---

## 17. Subgraph redeployment (do this AFTER contracts)

Now that the new contract address is known and `subgraph.yaml` has been updated, update the contract address in `packages/subgraph/subgraph.yaml`:

```yaml
dataSources:
  - kind: ethereum
    name: TerritoryNFT
    network: base-sepolia
    source:
      address: "0xNEW_NFT_CONTRACT_ADDRESS" # ← paste new address from step 16
      abi: TerritoryNFT
```

Do the same for `TerritoryMarketplace` and `TerritoryAuction` data sources in the same file.

Then build and deploy:

```bash
cd packages/subgraph
graph codegen
graph build
graph deploy --studio territory-nft
```

When prompted for a version label, enter `v0.0.2`. The deploy command will print the new endpoint URL:

```
https://api.studio.thegraph.com/query/YOUR_ID/territory-nft/v0.0.2
```

Update `apps/api/.env`:

```env
GRAPH_API_URL=https://api.studio.thegraph.com/query/YOUR_ID/territory-nft/v0.0.2
```

---

## Summary of everything removed

| What                                | Where                                                               |
| ----------------------------------- | ------------------------------------------------------------------- |
| `regionId` field                    | `TokenData` struct in contract                                      |
| `regionToToken` mapping             | `TerritoryNFT.sol`                                                  |
| One-token-per-region check          | `safeMint()`                                                        |
| `getTokenByRegion()`                | `TerritoryNFT.sol`                                                  |
| `regionId` param                    | `safeMint()` signature + event                                      |
| `game-bridge.ts`                    | Backend route — entire file deleted                                 |
| `conquest.service.ts`               | Backend service — entire file deleted                               |
| `game-auth.ts`                      | Backend middleware — entire file deleted                            |
| Prisma + PostgreSQL                 | Backend — entire `prisma/` folder, `db/` folder, dependency removed |
| `Region`, `Conquest`, `User` models | Were in Prisma schema — gone with Prisma                            |
| `MintJob.regionId`                  | Replaced with in-memory Map, no regionId field                      |
| `GAME_API_SECRET`                   | Env var — removed from config and .env                              |
| `DATABASE_URL`                      | Env var — removed from config and .env                              |
| Postgres service                    | `docker-compose.dev.yml`                                            |
| DB scripts                          | Root `package.json`                                                 |
| `regionId` in Token entity          | Subgraph schema                                                     |
| `regionId` in TokenMinted handler   | Subgraph mapping                                                    |
| `getByRegion`                       | Frontend `api.ts`                                                   |
| Conquest timeline                   | Profile page                                                        |
| Region ID field                     | Admin mint form                                                     |
