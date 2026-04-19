import TerritoryNFTAbi from 'territory-nft-shared/abis/TerritoryNFT.json'
import TerritoryMarketplaceAbi from 'territory-nft-shared/abis/TerritoryMarketplace.json'
import TerritoryAuctionAbi from 'territory-nft-shared/abis/TerritoryAuction.json'

export const USDC_DECIMALS = 6

export const CONTRACT_ADDRESSES = {
  nft:           process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS         as `0x${string}`,
  marketplace:   process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auction:       process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS     as `0x${string}`,
  paymentRouter: process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS       as `0x${string}`,
  usdc:          process.env.NEXT_PUBLIC_USDC_ADDRESS                 as `0x${string}`,
  uniswapRouter: process.env.NEXT_PUBLIC_UNISWAP_ROUTER               as `0x${string}`,
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NFT_ABI         = TerritoryNFTAbi         as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MARKETPLACE_ABI = TerritoryMarketplaceAbi as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AUCTION_ABI     = TerritoryAuctionAbi     as any

/** Minimal ERC-20 ABI — approve, allowance, balanceOf, transfer */
export const USDC_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

/** Uniswap v3 SwapRouter02 — exactInputSingle (ETH→USDC) */
export const UNISWAP_ROUTER_ABI = [
  {
    type: 'function',
    name: 'exactOutputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountOut', type: 'uint256' },
          { name: 'amountInMaximum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'refundETH',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
] as const
