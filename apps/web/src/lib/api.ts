import type { TokenInfo, Listing, Auction, Bid } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface SaleEvent {
  tokenId: bigint;
  seller: `0x${string}`;
  buyer: `0x${string}`;
  price: bigint;
  timestamp: number;
}

export interface AuctionHistoryEvent {
  tokenId: bigint;
  auctionId: bigint;
  bidder: `0x${string}`;
  amount: bigint;
  timestamp: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? "API error");
  return json.data as T;
}

/** Coerce API listing: price & tokenId come back as strings from JSON, need BigInt */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeListing(l: any): Listing {
  return { ...l, tokenId: BigInt(l.tokenId), price: BigInt(l.price) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeToken(t: any): TokenInfo {
  return { ...t, tokenId: BigInt(t.tokenId) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeAuction(a: any): Auction {
  return {
    ...a,
    auctionId: BigInt(a.auctionId),
    tokenId: BigInt(a.tokenId),
    highestBid: BigInt(a.highestBid),
    startPrice: BigInt(a.startPrice),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeBid(b: any): Bid {
  return {
    ...b,
    auctionId: BigInt(b.auctionId),
    amount: BigInt(b.amount),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeAuctionHistoryEvent(e: any): AuctionHistoryEvent {
  return {
    ...e,
    tokenId: BigInt(e.tokenId),
    auctionId: BigInt(e.auctionId),
    amount: BigInt(e.amount),
  };
}

export const api = {
  nft: {
    getByTokenId: (tokenId: string) =>
      apiFetch<any>(`/nft/${tokenId}`).then(deserializeToken),
    getByOwner: (wallet: string) =>
      apiFetch<any[]>(`/nft/owner/${wallet}`).then((ts) =>
        ts.map(deserializeToken),
      ),
    getAll: (skip = 0, take = 20, rarity?: number) =>
      apiFetch<any[]>(
        `/nft?skip=${skip}&take=${take}${rarity !== undefined ? `&rarity=${rarity}` : ""}`,
      ).then((ts) => ts.map(deserializeToken)),
  },
  marketplace: {
    getListings: (skip = 0, take = 20, rarity?: number, sort?: string) =>
      apiFetch<any[]>(
        `/marketplace/listings?skip=${skip}&take=${take}${rarity !== undefined ? `&rarity=${rarity}` : ""}${sort ? `&sort=${sort}` : ""}`,
      ).then((ls) => ls.map(deserializeListing)),
    getListing: (tokenId: string) =>
      apiFetch<any>(`/marketplace/listings/${tokenId}`).then(
        deserializeListing,
      ),
    getHistory: (tokenId: string) =>
      apiFetch<any[]>(`/marketplace/history/${tokenId}`),
    // .then(hs => hs.map((h: any) => ({ ...h, tokenId: BigInt(h.tokenId), price: BigInt(h.price) }) as SaleEvent));
  },
  auction: {
    getActive: () =>
      apiFetch<any[]>("/auction/active").then((as) =>
        as.map(deserializeAuction),
      ),
    getById: (id: string) =>
      apiFetch<any>(`/auction/${id}`).then(deserializeAuction),
    getBids: (id: string) =>
      apiFetch<any[]>(`/auction/${id}/bids`).then((bs) =>
        bs.map(deserializeBid),
      ),
    getTokenHistory: (tokenId: string) =>
      apiFetch<any[]>(`/auction/history/${tokenId}`).then((events) =>
        events.map(deserializeAuctionHistoryEvent),
      ),
  },
};
