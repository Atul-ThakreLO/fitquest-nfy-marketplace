import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  AuctionCreated as AuctionCreatedEvent,
  BidPlaced as BidPlacedEvent,
  AuctionFinalized as AuctionFinalizedEvent,
} from "../generated/TerritoryAuction/TerritoryAuction";
import { Auction, Bid } from "../generated/schema";
import { loadOrCreateUser } from "./helpers";

/**
 * Handle AuctionCreated event — creates a new Auction entity.
 */
export function handleAuctionCreated(event: AuctionCreatedEvent): void {
  let auctionId = event.params.auctionId;
  let tokenId = event.params.tokenId;
  let sellerId = event.params.seller.toHexString();

  // Ensure seller User exists
  loadOrCreateUser(sellerId);

  let auction = new Auction(auctionId.toString());

  auction.token = tokenId.toString();
  auction.seller = sellerId;
  auction.startPrice = event.params.startPrice;
  auction.highestBid = BigInt.fromI32(0);
  auction.highestBidder = null;
  auction.endTime = event.params.endTime;
  auction.finalized = false;
  auction.winner = null;
  auction.finalPrice = null;
  auction.createdAt = event.block.timestamp;

  auction.save();
}

/**
 * Handle BidPlaced event — creates a Bid entity and updates the Auction.
 */
export function handleBidPlaced(event: BidPlacedEvent): void {
  let auctionId = event.params.auctionId;
  let bidderId = event.params.bidder.toHexString();
  let amount = event.params.amount;

  // Ensure bidder User exists
  loadOrCreateUser(bidderId);

  // Create the Bid entity
  let bidId =
    auctionId.toString() +
    "-" +
    event.transaction.hash.toHex() +
    "-" +
    event.logIndex.toString();
  let bid = new Bid(bidId);

  bid.auction = auctionId.toString();
  bid.bidder = bidderId;
  bid.amount = amount;
  bid.timestamp = event.block.timestamp;
  bid.txHash = event.transaction.hash;

  bid.save();

  // Update the Auction's highest bid
  let auction = Auction.load(auctionId.toString());
  if (auction == null) return;

  auction.highestBid = amount;
  auction.highestBidder = bidderId;
  auction.save();
}

/**
 * Handle AuctionFinalized event — marks the Auction as finalized and records the winner.
 */
export function handleAuctionFinalized(event: AuctionFinalizedEvent): void {
  let auctionId = event.params.auctionId;
  let winnerId = event.params.winner.toHexString();

  // Ensure winner User exists
  loadOrCreateUser(winnerId);

  let auction = Auction.load(auctionId.toString());
  if (auction == null) return;

  auction.finalized = true;
  auction.winner = winnerId;
  auction.finalPrice = event.params.finalPrice;

  auction.save();
}
