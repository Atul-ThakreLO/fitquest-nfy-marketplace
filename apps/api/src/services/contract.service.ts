import {
  Account,
  getContract,
  parseUnits
} from 'viem'
import TerritoryNFTAbi from 'territory-nft-shared/abis/TerritoryNFT.json'
import TerritoryMarketplaceAbi from 'territory-nft-shared/abis/TerritoryMarketplace.json'
import TerritoryAuctionAbi from 'territory-nft-shared/abis/TerritoryAuction.json'
import config from '../config'
import type { Rarity, TokenInfo, Listing, Auction } from 'territory-nft-shared'

export class ContractService {
  private nft
  private marketplace
  private auction

  constructor(
    private publicClient: any,
    private walletClient: any,
    private account: Account,
  ) {
    this.nft = getContract({
      address: config.nftContractAddress,
      abi: TerritoryNFTAbi,
      client: { public: this.publicClient, wallet: this.walletClient },
    }) as any
    this.marketplace = getContract({
      address: config.marketplaceContractAddress,
      abi: TerritoryMarketplaceAbi,
      client: { public: this.publicClient, wallet: this.walletClient },
    }) as any
    this.auction = getContract({
      address: config.auctionContractAddress,
      abi: TerritoryAuctionAbi,
      client: { public: this.publicClient, wallet: this.walletClient },
    }) as any
  }

  // ── NFT reads ─────────────────────────────────────────────────────────────
  async getTokenData(tokenId: bigint): Promise<TokenInfo> {
    const data = await this.nft.read.getTokenData([tokenId]) as { rarity: number; ipfsCID: string; firstListed: boolean }
    const owner = await this.ownerOf(tokenId)
    return {
      tokenId,
      rarity: Number(data.rarity) as Rarity,
      ipfsCID: data.ipfsCID,
      firstListed: data.firstListed,
      owner,
    }
  }

  async ownerOf(tokenId: bigint): Promise<`0x${string}`> {
    return this.nft.read.ownerOf([tokenId]) as Promise<`0x${string}`>
  }

  // ── NFT writes (minter wallet) ────────────────────────────────────────────
  async mintToken(
    to: `0x${string}`,
    rarity: Rarity,
    ipfsCID: string,
  ): Promise<`0x${string}`> {
    return this.nft.write.safeMint([to, rarity, ipfsCID], { account: this.account }) as Promise<`0x${string}`>
  }

  async markFirstListed(tokenId: bigint): Promise<`0x${string}`> {
    return this.nft.write.markFirstListed([tokenId], { account: this.account }) as Promise<`0x${string}`>
  }

  // ── Marketplace reads/writes ──────────────────────────────────────────────
  async getListing(tokenId: bigint): Promise<Listing> {
    const data = await this.marketplace.read.getListing([tokenId]) as { seller: string; price: bigint; active: boolean }
    return {
      tokenId,
      rarity: 0,
      seller: data.seller as `0x${string}`,
      price: data.price,
      active: data.active,
      createdAt: 0,
    }
  }

  async canList(tokenId: bigint, user: string): Promise<boolean> {
    return this.marketplace.read.canList([tokenId, user]) as Promise<boolean>
  }

  async canBuy(tokenId: bigint, buyer: string): Promise<boolean> {
    return this.marketplace.read.canBuy([tokenId, buyer]) as Promise<boolean>
  }

  async createListing(tokenId: bigint, priceUsdc: string): Promise<`0x${string}`> {
    return this.marketplace.write.createListing([tokenId, parseUnits(priceUsdc, 6)], { account: this.account }) as Promise<`0x${string}`>
  }

  // ── Auction reads/writes ──────────────────────────────────────────────────

  // async createAuction(tokenId: number, price: number, duration: number) {
  //   this.auction.write.createAuction();
  // }

  async getAuction(auctionId: bigint): Promise<Auction> {
    // Note: use the public mapping 'auctions' as 'getAuction' view is not present in the deployed contract
    const data = await this.auction.read.auctions([auctionId]) as [
      string, // seller
      bigint, // tokenId
      bigint, // startPrice
      bigint, // highestBid
      string, // highestBidder
      bigint, // endTime
      boolean // finalized
    ]
    return {
      auctionId,
      seller: data[0] as `0x${string}`,
      tokenId: data[1],
      startPrice: data[2],
      highestBid: data[3],
      highestBidder: data[4] as `0x${string}`,
      endTime: Number(data[5]),
      finalized: data[6],
    }
  }

  async canCreateAuction(tokenId: bigint, user: string): Promise<boolean> {
    const owner = await this.ownerOf(tokenId)
    if (owner.toLowerCase() !== user.toLowerCase()) return false

    // Check approval
    const isApprovedForAll = await this.nft.read.isApprovedForAll([user, config.auctionContractAddress]) as boolean
    if (!isApprovedForAll) {
      const approved = await this.nft.read.getApproved([tokenId]) as string
      if (approved.toLowerCase() !== config.auctionContractAddress.toLowerCase()) return false
    }

    // Check rarity and firstListed
    const data = await this.nft.read.tokenData([tokenId]) as { rarity: number; firstListed: boolean }
    if (Number(data.rarity) !== 4) return false // MYTHIC
    if (!data.firstListed) return false

    return true
  }

  async canBid(auctionId: bigint, bidder: string, amount: bigint): Promise<boolean> {
    const auction = await this.getAuction(auctionId)
    if (auction.finalized) return false
    if (Date.now() / 1000 >= auction.endTime) return false
    if (bidder.toLowerCase() === auction.seller.toLowerCase()) return false

    let minBid: bigint
    if (auction.highestBidder === '0x0000000000000000000000000000000000000000') {
      minBid = auction.startPrice
    } else {
      minBid = auction.highestBid + (auction.highestBid * 5n) / 100n
    }
    return amount >= minBid
  }

  async finalizeAuction(auctionId: bigint): Promise<`0x${string}`> {
    return this.auction.write.finalizeAuction([auctionId], { account: this.account }) as Promise<`0x${string}`>
  }

  // ── Shared utility ────────────────────────────────────────────────────────
  async waitForTransaction(txHash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  computeCappedRoyalty(price: bigint, royaltyBps: number): bigint {
    const MAX_BPS = 1500n
    const raw = (price * BigInt(royaltyBps)) / 10000n
    const cap = (price * MAX_BPS) / 10000n
    return raw > cap ? cap : raw
  }
}
