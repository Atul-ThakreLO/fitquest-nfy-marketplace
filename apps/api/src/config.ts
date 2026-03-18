const config = {
  port: Number(Bun.env.PORT ?? 3001),
  keystoreName:       Bun.env.KEYSTORE_NAME ?? 'minter',
  pinataApiKey:       Bun.env.PINATA_API_KEY!,
  pinataSecretApiKey: Bun.env.PINATA_SECRET_API_KEY!,
  pinataGateway:      Bun.env.PINATA_GATEWAY_URL ?? 'https://gateway.pinata.cloud',
  pinataJWT:          Bun.env.PINATA_JWT!,
  adminApiSecret:     Bun.env.ADMIN_API_SECRET!,
  nftContractAddress:         Bun.env.NFT_CONTRACT_ADDRESS as `0x${string}`,
  marketplaceContractAddress: Bun.env.MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
  auctionContractAddress:     Bun.env.AUCTION_CONTRACT_ADDRESS as `0x${string}`,
  graphApiUrl:  Bun.env.GRAPH_API_URL!,
  redisUrl:     Bun.env.REDIS_URL ?? 'redis://localhost:6379',
  chainId: 84532,
} as const

const required = [
  'PINATA_API_KEY',
  'PINATA_SECRET_API_KEY',
  'ADMIN_API_SECRET',
  'NFT_CONTRACT_ADDRESS',
  'MARKETPLACE_CONTRACT_ADDRESS',
  'AUCTION_CONTRACT_ADDRESS',
  'GRAPH_API_URL',
]

for (const key of required) {
  if (!Bun.env[key]) throw new Error(`Missing required env var: ${key}`)
}

export default config
