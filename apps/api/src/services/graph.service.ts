import config from "../config";
import type { Listing, Auction, Bid } from "territory-nft-shared";

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

async function graphQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(config.graphApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Graph query failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as GraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(
      `Graph query errors: ${json.errors.map((e) => e.message).join(", ")}`,
    );
  }

  return json.data;
}

class GraphService {
  /**
   * Get all active marketplace listings, paginated.
   */
  async getActiveListings(
    skip: number,
    take: number,
    rarity?: number,
    sort?: string,
  ): Promise<Listing[]> {
    let orderBy = "createdAt";
    let orderDirection = "desc";

    if (sort === "price_asc") {
      orderBy = "price";
      orderDirection = "asc";
    } else if (sort === "price_desc") {
      orderBy = "price";
      orderDirection = "desc";
    }

    const hasRarity = rarity !== undefined;
    const rarityCondition = hasRarity ? ", token_: { rarity: $rarity }" : "";

    const query = `
      query ActiveListings($skip: Int!, $take: Int!${hasRarity ? ", $rarity: Int!" : ""}) {
        listings(
          where: { active: true${rarityCondition} }
          orderBy: ${orderBy}
          orderDirection: ${orderDirection}
          first: $take
          skip: $skip
        ) {
          id
          token { 
            id 
            rarity 
          }
          seller { id }
          price
          active
          createdAt
        }
      }
    `;

    const variables: Record<string, any> = { skip, take };
    if (hasRarity) {
      variables.rarity = rarity;
    }

    const data = await graphQuery<{
      listings: Array<{
        id: string;
        token: { id: string; rarity: number };
        seller: { id: string };
        price: string;
        active: boolean;
        createdAt: string;
      }>;
    }>(query, variables);

    return data.listings.map((l) => ({
      tokenId: BigInt(l.token.id),
      rarity: l.token.rarity,
      seller: l.seller.id as `0x${string}`,
      price: BigInt(l.price),
      active: l.active,
      createdAt: Number(l.createdAt),
    }));
  }

  /**
   * Get listing and sale history for a specific token.
   */
  async getTokenHistory(tokenId: bigint): Promise<
    Array<{
      event: "Listed" | "Sold" | "Cancelled";
      price: bigint;
      from: string;
      to?: string;
      timestamp: number;
    }>
  > {
    const query = `
      query TokenHistory($tokenId: ID!) {
        listings(where: { token: $tokenId }, orderBy: createdAt, orderDirection: desc) {
          id
          seller { id }
          price
          active
          createdAt
        }
        sales(where: { token: $tokenId }, orderBy: timestamp, orderDirection: desc) {
          id
          seller { id }
          buyer { id }
          price
          timestamp
        }
      }
    `;

    const data = await graphQuery<{
      listings: Array<{
        id: string;
        seller: { id: string };
        price: string;
        active: boolean;
        createdAt: string;
      }>;
      sales: Array<{
        id: string;
        seller: { id: string };
        buyer: { id: string };
        price: string;
        timestamp: string;
      }>;
    }>(query, { tokenId: tokenId.toString() });

    const history: Array<{
      event: "Listed" | "Sold" | "Cancelled";
      price: bigint;
      from: string;
      to?: string;
      timestamp: number;
    }> = [];

    for (const listing of data.listings) {
      history.push({
        event: listing.active ? "Listed" : "Cancelled",
        price: BigInt(listing.price),
        from: listing.seller.id,
        timestamp: Number(listing.createdAt),
      });
    }

    for (const sale of data.sales) {
      history.push({
        event: "Sold",
        price: BigInt(sale.price),
        from: sale.seller.id,
        to: sale.buyer.id,
        timestamp: Number(sale.timestamp),
      });
    }

    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all active (non-finalized) auctions.
   */
  async getActiveAuctions(): Promise<Auction[]> {
    const query = `
      query ActiveAuctions {
        auctions(where: { finalized: false }, orderBy: endTime, orderDirection: asc) {
          id
          token { id }
          seller { id }
          startPrice
          highestBid
          highestBidder { id }
          endTime
          finalized
        }
      }
    `;

    const data = await graphQuery<{
      auctions: Array<{
        id: string;
        token: { id: string };
        seller: { id: string };
        startPrice: string;
        highestBid: string;
        highestBidder: { id: string } | null;
        endTime: string;
        finalized: boolean;
      }>;
    }>(query);

    return data.auctions.map((a) => ({
      auctionId: BigInt(a.id),
      tokenId: BigInt(a.token.id),
      seller: a.seller.id as `0x${string}`,
      highestBidder: (a.highestBidder?.id ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`,
      highestBid: BigInt(a.highestBid),
      startPrice: BigInt(a.startPrice),
      endTime: Number(a.endTime),
      finalized: a.finalized,
    }));
  }

  /**
   * Get all bids for a specific auction.
   */
  async getAuctionBids(auctionId: bigint): Promise<Bid[]> {
    const query = `
      query AuctionBids($auctionId: ID!) {
        bids(where: { auction: $auctionId }, orderBy: timestamp, orderDirection: desc) {
          id
          auction { id }
          bidder { id }
          amount
          timestamp
          txHash
        }
      }
    `;

    const data = await graphQuery<{
      bids: Array<{
        id: string;
        auction: { id: string };
        bidder: { id: string };
        amount: string;
        timestamp: string;
        txHash: string;
      }>;
    }>(query, { auctionId: auctionId.toString() });

    return data.bids.map((b) => ({
      auctionId: BigInt(b.auction.id),
      bidder: b.bidder.id as `0x${string}`,
      amount: BigInt(b.amount),
      blockTimestamp: Number(b.timestamp),
    }));
  }

  /**
   * Get all auction bid points for a token across all auctions.
   */
  async getTokenAuctionHistory(tokenId: bigint): Promise<
    Array<{
      tokenId: bigint;
      auctionId: bigint;
      bidder: `0x${string}`;
      amount: bigint;
      timestamp: number;
    }>
  > {
    const query = `
      query TokenAuctionHistory($tokenId: ID!) {
        bids(
          where: { auction_: { token: $tokenId } }
          orderBy: timestamp
          orderDirection: desc
        ) {
          auction { id token { id } }
          bidder { id }
          amount
          timestamp
        }
      }
    `;

    const data = await graphQuery<{
      bids: Array<{
        auction: { id: string; token: { id: string } };
        bidder: { id: string };
        amount: string;
        timestamp: string;
      }>;
    }>(query, { tokenId: tokenId.toString() });

    return data.bids.map((b) => ({
      tokenId: BigInt(b.auction.token.id),
      auctionId: BigInt(b.auction.id),
      bidder: b.bidder.id as `0x${string}`,
      amount: BigInt(b.amount),
      timestamp: Number(b.timestamp),
    }));
  }

  /**
   * Get all token IDs currently owned by a wallet address.
   */
  async getTokensByOwner(walletAddress: string): Promise<bigint[]> {
    const query = `
      query TokensByOwner($wallet: ID!) {
        user(id: $wallet) {
          tokens { id }
        }
      }
    `;

    const data = await graphQuery<{
      user: { tokens: Array<{ id: string }> } | null;
    }>(query, { wallet: walletAddress.toLowerCase() });

    return (data.user?.tokens ?? []).map((t) => BigInt(t.id));
  }
}

export const graphService = new GraphService();
