import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  TerritoryMarketplace as TerritoryMarketplaceContract,
  Listed as ListedEvent,
  Sold as SoldEvent,
  ListingCancelled as ListingCancelledEvent,
  PriceUpdated as PriceUpdatedEvent,
} from "../generated/TerritoryMarketplace/TerritoryMarketplace";
import { TerritoryNFT as TerritoryNFTContract } from "../generated/TerritoryNFT/TerritoryNFT";
import { Listing, Sale } from "../generated/schema";
import { loadOrCreateUser } from "./helpers";

/**
 * Handle Listed event — creates a new Listing entity.
 *
 * Listing ID = tokenId.toString(). A token can only have one active listing
 * at a time on the contract (it reverts otherwise), so this key is stable
 * and allows Cancel/PriceUpdate handlers to find and mutate the same entity.
 */
export function handleListed(event: ListedEvent): void {
  let tokenId = event.params.tokenId;
  let sellerId = event.params.seller.toHexString();

  // Ensure seller User exists
  loadOrCreateUser(sellerId);

  // Upsert the listing — the contract prevents double-listing, but we guard anyway
  let listing = Listing.load(tokenId.toString());
  if (listing == null) {
    listing = new Listing(tokenId.toString());
  }

  listing.token = tokenId.toString();
  listing.seller = sellerId;
  listing.price = event.params.price;
  listing.currency = "USDC";
  listing.active = true;
  listing.createdAt = event.block.timestamp;
  listing.updatedAt = event.block.timestamp;

  listing.save();
}

/**
 * Handle Sold event — creates a Sale entity and deactivates the Listing.
 */
export function handleSold(event: SoldEvent): void {
  let tokenId = event.params.tokenId;
  let sellerId = event.params.seller.toHexString();
  let buyerId = event.params.buyer.toHexString();

  // Ensure buyer User exists
  loadOrCreateUser(buyerId);

  // Deactivate the listing
  let listing = Listing.load(tokenId.toString());
  if (listing != null) {
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }

  // Create the sale record
  let saleId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let sale = new Sale(saleId);

  sale.token = tokenId.toString();
  sale.seller = sellerId;
  sale.buyer = buyerId;
  sale.price = event.params.price;
  sale.currency = "USDC";
  sale.timestamp = event.block.timestamp;
  sale.txHash = event.transaction.hash;

  // Marketplace does not emit royalty values in the `Sold` event, so
  // we compute them at indexing time via the NFT's ERC-2981 royaltyInfo().
  // We also apply the same 15% cap as the contract (MAX_ROYALTY_BPS=1500).
  let marketplace = TerritoryMarketplaceContract.bind(event.address);
  let nftAddress = marketplace.nftContract();
  let nft = TerritoryNFTContract.bind(nftAddress);

  let royaltyAmount = BigInt.fromI32(0);
  let royaltyCapped = false;
  let royaltyCall = nft.try_royaltyInfo(tokenId, event.params.price);

  if (!royaltyCall.reverted) {
    // ERC-2981 returns (receiver, amount)
    let computed = royaltyCall.value.value1;

    // maxRoyalty = salePrice * 1500 / 10000
    let maxRoyalty = event.params.price
      .times(BigInt.fromI32(1500))
      .div(BigInt.fromI32(10000));

    if (computed.gt(maxRoyalty)) {
      royaltyAmount = maxRoyalty;
      royaltyCapped = true;
    } else {
      royaltyAmount = computed;
    }
  } else {
    log.warning(
      "royaltyInfo reverted for tokenId {}",
      [tokenId.toString()]
    );
  }

  sale.royaltyAmount = royaltyAmount;
  sale.royaltyCapped = royaltyCapped;

  sale.save();
}

/**
 * Handle ListingCancelled event — marks the listing as inactive.
 */
export function handleListingCancelled(event: ListingCancelledEvent): void {
  let tokenId = event.params.tokenId;

  let listing = Listing.load(tokenId.toString());
  if (listing != null) {
    listing.active = false;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }
}

/**
 * Handle PriceUpdated event — updates the listing price.
 */
export function handlePriceUpdated(event: PriceUpdatedEvent): void {
  let tokenId = event.params.tokenId;

  let listing = Listing.load(tokenId.toString());
  if (listing != null) {
    listing.price = event.params.newPrice;
    listing.updatedAt = event.block.timestamp;
    listing.save();
  }
}
