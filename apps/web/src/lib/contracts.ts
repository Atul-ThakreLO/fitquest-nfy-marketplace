import TerritoryNFTAbi from 'territory-nft-shared/abis/TerritoryNFT.json'
import TerritoryMarketplaceAbi from 'territory-nft-shared/abis/TerritoryMarketplace.json'
import TerritoryAuctionAbi from 'territory-nft-shared/abis/TerritoryAuction.json'

export const CONTRACT_ADDRESSES = {
  nft:         process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS         as `0x${string}`,
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auction:     process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS     as `0x${string}`,
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NFT_ABI         = TerritoryNFTAbi.abi         as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MARKETPLACE_ABI = TerritoryMarketplaceAbi.abi as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AUCTION_ABI     = TerritoryAuctionAbi.abi     as any
