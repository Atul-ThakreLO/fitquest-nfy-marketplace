# Territory NFT — Game Bridge API Documentation

> **For the Mobile Game Team**  
> This document describes all API endpoints your game app needs to call.  
> You do not need to interact with the blockchain directly. Everything is handled for you.

---

## Authentication

Every request **must** include a shared secret header:

```
X-Game-Secret: <shared-secret-provided-by-territory-team>
```

All endpoints return **`401 Unauthorized`** if this header is missing or incorrect.

---

## Base URLs

| Environment | URL |
|---|---|
| Production | `https://api.territorynft.xyz` |
| Development | `http://localhost:3001` |

---

## Endpoints

---

### `GET /game/regions`

Returns all regions with their NFT assignment status and image URL.

**Use this to render your conquest map on startup.** The `imageUrl` field is the fully resolved HTTPS URL of the tile artwork — pass it directly to your image renderer.

#### Request

```
GET /game/regions
X-Game-Secret: <secret>
```

No query parameters required.

#### Response

```json
{
  "regions": [
    {
      "regionId": 42,
      "tokenId": "7",
      "hasNft": true,
      "rarity": "EPIC",
      "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm.../image.png",
      "metadataUrl": "https://gateway.pinata.cloud/ipfs/Qm.../metadata.json",
      "owner": "0xabc123...",
      "firstListed": true
    },
    {
      "regionId": 99,
      "tokenId": null,
      "hasNft": false,
      "rarity": null,
      "imageUrl": null,
      "metadataUrl": null,
      "owner": null,
      "firstListed": false
    }
  ],
  "total": 2
}
```

| Field | Type | Description |
|---|---|---|
| `regionId` | `number` | Unique region identifier in your game |
| `tokenId` | `string \| null` | On-chain NFT token ID (null if no NFT minted yet) |
| `hasNft` | `boolean` | Whether this region has a minted NFT |
| `rarity` | `string \| null` | `"COMMON"`, `"RARE"`, `"EPIC"`, `"LEGENDARY"`, `"MYTHIC"`, or `null` |
| `imageUrl` | `string \| null` | Full HTTPS URL of the PNG tile art; use directly as image source |
| `metadataUrl` | `string \| null` | Full HTTPS URL to the NFT's JSON metadata |
| `owner` | `string \| null` | Current wallet address of the NFT owner |
| `firstListed` | `boolean` | Whether the org has completed the initial listing (enables trading) |

---

### `GET /game/region/:id`

Single region lookup. **Call this after a user conquers a tile** to get the NFT image to display as the tile art overlay.

#### Request

```
GET /game/region/42
X-Game-Secret: <secret>
```

| Parameter | Location | Type | Description |
|---|---|---|---|
| `id` | path | `number` | Region ID |

#### Response

```json
{
  "regionId": 42,
  "tokenId": "7",
  "hasNft": true,
  "rarity": "EPIC",
  "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm.../image.png",
  "metadataUrl": "https://gateway.pinata.cloud/ipfs/Qm.../metadata.json",
  "owner": "0xabc123...",
  "firstListed": true
}
```

Same shape as a single element from `GET /game/regions`.

#### Errors

| Code | Reason |
|---|---|
| `404` | No region with this ID exists |

---

### `POST /game/conquest`

Records that a user has physically walked a region.

> **Important**: This call does **not** automatically transfer the NFT. The user must go to the marketplace and purchase it. This endpoint simply records the conquest event for stats and enables the buy flow on the marketplace UI.

**This endpoint is idempotent**: calling it again with the same `gameSessionId` returns `200` with the existing conquest record — no duplicate will be created.

#### Request

```
POST /game/conquest
X-Game-Secret: <secret>
Content-Type: application/json
```

```json
{
  "regionId": 42,
  "walletAddress": "0xabc123...",
  "stepCount": 8400,
  "gameSessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `regionId` | `number` | ✅ | The region the user walked |
| `walletAddress` | `string` | ✅ | User's connected wallet address (checksummed or lowercase) |
| `stepCount` | `number` | ✅ | Number of steps recorded during the conquest walk |
| `gameSessionId` | `string` (UUID) | ✅ | Unique ID for this game session — used for idempotency |

#### Response `200 OK`

```json
{
  "conquestId": "clxyz123abc",
  "regionId": 42,
  "walletAddress": "0xabc123...",
  "stepCount": 8400,
  "gameSessionId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2025-10-01T12:34:56.789Z",
  "isDuplicate": false
}
```

| Field | Type | Description |
|---|---|---|
| `conquestId` | `string` | Our internal conquest record ID |
| `isDuplicate` | `boolean` | `true` if this `gameSessionId` was already recorded |

#### Errors

| Code | Reason |
|---|---|
| `400` | Validation error (missing fields, invalid `regionId` or `walletAddress`) |
| `409` | The region was already conquered by a **different** wallet in this session |

---

### `GET /game/conquest/:wallet`

Returns all conquests for a wallet address. Use for the **profile / stats screen**.

#### Request

```
GET /game/conquest/0xabc123...
X-Game-Secret: <secret>
```

| Parameter | Location | Type | Description |
|---|---|---|---|
| `wallet` | path | `string` | Wallet address (checksummed or lowercase) |

#### Response `200 OK`

```json
{
  "wallet": "0xabc123...",
  "conquests": [
    {
      "conquestId": "clxyz123abc",
      "regionId": 42,
      "stepCount": 8400,
      "gameSessionId": "550e8400-e29b-41d4-a716-446655440000",
      "region": {
        "tokenId": "7",
        "hasNft": true,
        "rarity": "EPIC",
        "imageUrl": "https://gateway.pinata.cloud/ipfs/Qm.../image.png"
      },
      "createdAt": "2025-10-01T12:34:56.789Z"
    }
  ],
  "total": 1
}
```

Each conquest includes a nested `region` object so you can display the tile art without a second call.

---

## NFT Image Rendering Guide

### How images are stored

All NFT images and metadata are stored on **IPFS** via [Pinata](https://pinata.cloud). The `imageUrl` and `metadataUrl` fields in every API response are:

- ✅ **Always full HTTPS URLs** — no IPFS URL resolution needed on your side
- ✅ **Served via the Pinata gateway** — reliable, fast, CDN-backed
- ✅ **Always PNG format** — no format detection needed

### How to use them

Simply pass the `imageUrl` directly to any image loading library:

```
imageUrl = "https://gateway.pinata.cloud/ipfs/QmXyz.../image.png"
```

Use this URL as-is as the `src` attribute of an `<img>` tag, a React Native `Image` source, or any other image renderer.

### Do not store or cache IPFS CIDs

If you ever need to re-fetch an image URL, call `GET /game/region/:id` — the API always returns the canonical, fully-resolved URL.

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `400` | Bad Request | Missing required fields or failed validation |
| `401` | Unauthorized | `X-Game-Secret` header is missing or incorrect |
| `404` | Not Found | The requested region or wallet does not exist |
| `409` | Conflict | Region already conquered by a different wallet in the same session |
| `500` | Internal Server Error | Unexpected server error — contact the Territory team |

### Error Response Shape

All errors return a consistent JSON body:

```json
{
  "error": {
    "code": "REGION_NOT_FOUND",
    "message": "No region with ID 999 found.",
    "statusCode": 404
  }
}
```

| Code string | HTTP status | Trigger |
|---|---|---|
| `INVALID_REQUEST` | 400 | Validation failure |
| `UNAUTHORIZED` | 401 | Missing or wrong `X-Game-Secret` |
| `REGION_NOT_FOUND` | 404 | Unknown `regionId` |
| `CONQUEST_CONFLICT` | 409 | Same region, different wallet, same session |
| `INTERNAL_ERROR` | 500 | Unexpected server-side failure |

---

*Last updated: March 2026 — Territory NFT Team*
