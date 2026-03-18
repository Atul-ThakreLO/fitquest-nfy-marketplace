# Prompt 02 — Smart Contracts

> **Cursor instruction**: Work entirely inside `packages/contracts/`. Write all three Solidity contracts, deploy scripts, and Foundry tests. Use OpenZeppelin 5.x prebuilts — do not reimplement anything OZ already provides.

---

## Contracts to Write

```
packages/contracts/src/
├── TerritoryNFT.sol
├── TerritoryMarketplace.sol
└── TerritoryAuction.sol

packages/contracts/test/
├── TerritoryNFT.t.sol
├── TerritoryMarketplace.t.sol
└── TerritoryAuction.t.sol

packages/contracts/script/
├── Deploy.s.sol
└── DeployConfig.sol
```

---

## Contract 1 — `TerritoryNFT.sol`

### Imports (use OZ, never reimplement)

```solidity
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
```

### Roles

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant LISTER_ROLE  = keccak256("LISTER_ROLE");
```

### Rarity Enum

```solidity
enum Rarity { COMMON, RARE, EPIC, LEGENDARY, MYTHIC }
```

### Token Metadata Struct

```solidity
struct TokenData {
    Rarity  rarity;
    uint16  regionId;
    string  ipfsCID;
    bool    firstListed;
}

mapping(uint256 => TokenData) public tokenData;
```

### Core Functions

**`safeMint(address to, Rarity rarity, uint16 regionId, string calldata ipfsCID)`**
- Requires `MINTER_ROLE`
- Increments tokenId counter
- Stores TokenData
- Sets tokenURI to `ipfs://{ipfsCID}/metadata.json`
- Emits `TokenMinted(tokenId, to, rarity, regionId)`
- Enforces: one token per regionId (mapping `regionId → tokenId`, reverts if already set)

**`markFirstListed(uint256 tokenId)`**
- Requires `LISTER_ROLE`
- Sets `tokenData[tokenId].firstListed = true`
- Emits `FirstListingMarked(tokenId)`

**`getTokenData(uint256 tokenId)`** → returns full `TokenData`

**`getTokenByRegion(uint16 regionId)`** → returns `tokenId` (or reverts if not minted)

**`isTransferable(uint256 tokenId)`** → returns `true` only if `firstListed == true`

### Transfer Guard

Override `_beforeTokenTransfer` to block transfers when `firstListed == false`, EXCEPT:
- Transfers from address(0) (minting is allowed)
- Transfers FROM the org wallet (LISTER_ROLE holder) are allowed (org initial transfer to marketplace)

### Royalties

In constructor, call:
```solidity
_setDefaultRoyalty(orgTreasury, 500); // 5% = 500 basis points
```
Where `orgTreasury` is a constructor parameter (the Gnosis Safe address).

### Constructor

```solidity
constructor(address admin, address minter, address orgTreasury)
```
- Grants `DEFAULT_ADMIN_ROLE` to `admin`
- Grants `MINTER_ROLE` and `LISTER_ROLE` to `minter`
- Sets royalty receiver to `orgTreasury`

---

## Contract 2 — `TerritoryMarketplace.sol`

### Imports

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
```

### State

```solidity
IERC721 public immutable nftContract;
address public immutable royaltyReceiver; // for paying out royalties

struct Listing {
    address seller;
    uint256 price;      // in wei
    bool    active;
}
mapping(uint256 tokenId => Listing) public listings;
```

### Core Functions

**`createListing(uint256 tokenId, uint256 price)`**
- Caller must be `ownerOf(tokenId)` OR have LISTER_ROLE on NFT contract (org first listing)
- NFT must be approved to this contract (`getApproved` or `isApprovedForAll`)
- Token must have `firstListed == true` OR caller has LISTER_ROLE
- Price must be > 0
- Emits `Listed(tokenId, seller, price)`

**`buyListing(uint256 tokenId)`** — payable
- Listing must be active
- `msg.value >= listing.price`
- Computes royalty via `IERC2981(nftContract).royaltyInfo(tokenId, price)`
- Transfers royalty to royaltyReceiver
- Transfers remainder to seller
- Calls `nftContract.safeTransferFrom(seller, buyer, tokenId)`
- Deletes listing
- Refunds overpayment
- Emits `Sold(tokenId, seller, buyer, price)`

**`cancelListing(uint256 tokenId)`**
- Caller must be listing.seller
- Deletes listing
- Emits `ListingCancelled(tokenId)`

**`updatePrice(uint256 tokenId, uint256 newPrice)`**
- Caller must be listing.seller
- Emits `PriceUpdated(tokenId, newPrice)`

**`getListing(uint256 tokenId)`** → returns `Listing`

---

## Contract 3 — `TerritoryAuction.sol`

### Imports

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
```

### State

```solidity
struct Auction {
    address seller;
    uint256 tokenId;
    uint256 startPrice;
    uint256 highestBid;
    address highestBidder;
    uint256 endTime;
    bool    finalized;
}

uint256 public auctionCounter;
mapping(uint256 auctionId => Auction) public auctions;
mapping(address bidder => mapping(uint256 auctionId => uint256)) public pendingReturns;

uint8 public constant MIN_BID_INCREMENT_PERCENT = 5;
```

### Core Functions

**`createAuction(uint256 tokenId, uint256 startPrice, uint256 durationSeconds)`**
- Caller must be `ownerOf(tokenId)`
- Token rarity must be MYTHIC (query `ITerritoryNFT(nftAddress).tokenData(tokenId).rarity == Rarity.MYTHIC`)
- Token must have `firstListed == true`
- Duration: minimum 1 hour, maximum 7 days
- NFT transferred to this contract (escrow)
- Emits `AuctionCreated(auctionId, tokenId, seller, startPrice, endTime)`

**`bid(uint256 auctionId)`** — payable
- Auction must not be finalized, `block.timestamp < endTime`
- `msg.value >= startPrice` (if no bids yet)
- `msg.value >= highestBid * (100 + MIN_BID_INCREMENT_PERCENT) / 100` (if bids exist)
- Previous highest bidder's amount added to `pendingReturns`
- Updates `highestBid` and `highestBidder`
- **Auction extension**: if bid arrives within last 10 minutes, extend by 10 minutes (anti-sniping)
- Emits `BidPlaced(auctionId, bidder, amount)`

**`finalizeAuction(uint256 auctionId)`**
- `block.timestamp >= endTime`
- Not already finalized
- If there's a winner: compute royalty, pay royaltyReceiver, pay seller, transfer NFT to winner
- If no bids: return NFT to seller
- Emits `AuctionFinalized(auctionId, winner, finalPrice)` or `AuctionCancelledNoBids`

**`withdrawPendingReturn(uint256 auctionId)`**
- Transfers `pendingReturns[msg.sender][auctionId]` back to caller
- Uses checks-effects-interactions pattern
- Emits `PendingReturnWithdrawn(bidder, amount)`

**`cancelAuction(uint256 auctionId)`**
- Only seller, only if no bids placed
- Returns NFT to seller
- Emits `AuctionCancelled(auctionId)`

---

## Foundry Tests

### `TerritoryNFT.t.sol`

Cover:
- `testMintRequiresMinterRole` — non-minter reverts
- `testMintSucceeds` — correct tokenData stored
- `testOneTokenPerRegion` — second mint for same regionId reverts
- `testTransferBlockedBeforeFirstListed`
- `testTransferAllowedAfterFirstListed`
- `testMarkFirstListedRequiresListerRole`
- `testRoyaltyInfo` — returns 5% of sale price to orgTreasury

### `TerritoryMarketplace.t.sol`

Cover:
- `testCreateListingByOwner`
- `testCreateListingRequiresFirstListed`
- `testBuyListingTransfersNFTAndFunds`
- `testRoyaltyPaidOnSale`
- `testCancelListing`
- `testBuyRefundsOverpayment`
- `testCannotBuyOwnListing`

### `TerritoryAuction.t.sol`

Cover:
- `testCreateAuctionOnlyMythic` — non-MYTHIC reverts
- `testBidBelowMinimumReverts`
- `testBidIncrementEnforced`
- `testAuctionExtensionOnLastMinuteBid`
- `testFinalizeAuctionWithWinner`
- `testFinalizeAuctionNoBids`
- `testWithdrawPendingReturn`
- `testCancelAuctionNoBids`
- `testCancelAuctionWithBidsReverts`

Use Foundry `vm.prank`, `vm.deal`, `vm.warp` utilities throughout.

---

## Deploy Script (`script/Deploy.s.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/TerritoryAuction.sol";

contract Deploy is Script {
    function run() external {
        address admin     = vm.envAddress("ADMIN_ADDRESS");
        address minter    = vm.envAddress("MINTER_ADDRESS");
        address treasury  = vm.envAddress("ORG_TREASURY_ADDRESS");

        vm.startBroadcast();

        TerritoryNFT nft = new TerritoryNFT(admin, minter, treasury);
        TerritoryMarketplace market = new TerritoryMarketplace(address(nft), treasury);
        TerritoryAuction auction   = new TerritoryAuction(address(nft), treasury);

        console.log("TerritoryNFT:         ", address(nft));
        console.log("TerritoryMarketplace: ", address(market));
        console.log("TerritoryAuction:     ", address(auction));

        vm.stopBroadcast();
    }
}
```

Deploy command:
```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

---

## After Contracts Compile

Run the ABI sync script:
```bash
cd packages/shared
bun run sync-abis
```

This copies the compiled ABIs into `packages/shared/src/abis/` for use by the frontend and backend.
