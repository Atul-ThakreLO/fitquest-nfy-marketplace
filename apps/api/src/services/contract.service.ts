import {
  Account,
  getContract,
  parseEther
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
      abi: TerritoryNFTAbi.abi,
      client: { public: this.publicClient, wallet: this.walletClient },
    }) as any
    this.marketplace = getContract({
      address: config.marketplaceContractAddress,
      abi: TerritoryMarketplaceAbi.abi,
      client: { public: this.publicClient, wallet: this.walletClient },
    }) as any
    this.auction = getContract({
      address: config.auctionContractAddress,
      abi: TerritoryAuctionAbi.abi,
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
      seller: data.seller as `0x${string}`,
      price: data.price,
      active: data.active,
      createdAt: 0,
    }
  }

  async createListing(tokenId: bigint, priceEth: string): Promise<`0x${string}`> {
    return this.marketplace.write.createListing([tokenId, parseEther(priceEth)], { account: this.account }) as Promise<`0x${string}`>
  }

  // ── Auction reads/writes ──────────────────────────────────────────────────
  async getAuction(auctionId: bigint): Promise<Auction> {
    const data = await this.auction.read.getAuction([auctionId]) as {
      tokenId: bigint;
      seller: string;
      startPrice: bigint;
      highestBidder: string;
      highestBid: bigint;
      endTime: bigint;
      finalized: boolean;
    }
    return {
      auctionId,
      tokenId: data.tokenId,
      seller: data.seller as `0x${string}`,
      startPrice: data.startPrice,
      highestBidder: data.highestBidder as `0x${string}`,
      highestBid: data.highestBid,
      endTime: Number(data.endTime),
      finalized: data.finalized,
    }
  }

  async finalizeAuction(auctionId: bigint): Promise<`0x${string}`> {
    return this.auction.write.finalizeAuction([auctionId], { account: this.account }) as Promise<`0x${string}`>
  }

  // ── Shared utility ────────────────────────────────────────────────────────
  async waitForTransaction(txHash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash: txHash })
  }
}
