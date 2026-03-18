# Prompt 03 — The Graph Subgraph

> **Cursor instruction**: Set up a subgraph inside `packages/subgraph/` to index all three smart contract events. Use `@graphprotocol/graph-cli` and `@graphprotocol/graph-ts`.

---

## Init

```bash
mkdir packages/subgraph && cd packages/subgraph
npx graph init --product hosted-service \
  --from-contract <NFT_CONTRACT_ADDRESS> \
  --network base-sepolia \
  --abi ../contracts/out/TerritoryNFT.sol/TerritoryNFT.json \
  territory-nft/territory-nft
```

## Events to index

From `TerritoryNFT.sol`:
- `TokenMinted(uint256 tokenId, address owner, uint8 rarity, uint16 regionId)`
- `Transfer(address from, address to, uint256 tokenId)` — from ERC721

From `TerritoryMarketplace.sol`:
- `Listed(uint256 tokenId, address seller, uint256 price)`
- `Sold(uint256 tokenId, address seller, address buyer, uint256 price)`
- `ListingCancelled(uint256 tokenId)`
- `PriceUpdated(uint256 tokenId, uint256 newPrice)`

From `TerritoryAuction.sol`:
- `AuctionCreated(uint256 auctionId, uint256 tokenId, address seller, uint256 startPrice, uint256 endTime)`
- `BidPlaced(uint256 auctionId, address bidder, uint256 amount)`
- `AuctionFinalized(uint256 auctionId, address winner, uint256 finalPrice)`

## Schema (schema.graphql)

Define entities: `Token`, `Listing`, `Sale`, `Auction`, `Bid`, `User`

Each `Token` entity should have:
- `id` (tokenId as string)
- `owner`
- `rarity`
- `regionId`
- `ipfsCID`
- `firstListed`
- `listings` (relation)
- `auctions` (relation)

---

# Prompt 07 — Game Bridge API Documentation

> **Cursor instruction**: Generate a `GAME_BRIDGE_API.md` file in the repo root. This is the contract document for the mobile game team. Write it clearly — they are not blockchain developers.

---

## Contents to include

### Authentication
```
Header: X-Game-Secret: <shared secret>
All endpoints return 401 if missing or wrong
```

### Base URL
```
Production:  https://api.territorynft.xyz
Development: http://localhost:3001
```

### Endpoints

Document each with: description, request shape, response shape, example.

**`GET /game/regions`**
Returns all regions with their NFT assignment status and resolved image URL.
Game uses this to render the conquest map — the `imageUrl` field is what gets rendered as the tile art.

**`GET /game/region/:id`**
Single region lookup. Game calls this after a user conquers a tile to get the NFT image to display.

**`POST /game/conquest`**
Records that a user walked a region. Body:
```json
{
  "regionId": 42,
  "walletAddress": "0x...",
  "stepCount": 8400,
  "gameSessionId": "uuid-here"
}
```
Idempotent — duplicate `gameSessionId` returns 200 with the existing record.
Does NOT automatically transfer the NFT — user must buy it on the marketplace.

**`GET /game/conquest/:wallet`**
All conquests for a wallet address. Game uses for profile/stats screen.

### NFT Image Rendering Guide
Explain: images are stored on IPFS, resolved through Pinata gateway. The `imageUrl` field is always a full HTTPS URL — no IPFS URL resolution needed on the game side. Image format is always PNG.

### Error codes
- `400` Bad request (validation)
- `401` Missing or invalid `X-Game-Secret`
- `404` Region not found
- `409` Region already conquered by different wallet in same session
- `500` Internal server error
