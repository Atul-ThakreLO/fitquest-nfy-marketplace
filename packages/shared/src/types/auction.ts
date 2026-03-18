export interface Auction {
  auctionId: bigint
  tokenId: bigint
  seller: `0x${string}`
  highestBidder: `0x${string}`
  highestBid: bigint
  startPrice: bigint
  endTime: number         // unix timestamp
  finalized: boolean
}

export interface Bid {
  auctionId: bigint
  bidder: `0x${string}`
  amount: bigint
  blockTimestamp: number
}
