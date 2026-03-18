import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { bearer } from '@elysiajs/bearer'
import { nftRoutes } from './routes/nft'
import { marketplaceRoutes } from './routes/marketplace'
import { auctionRoutes } from './routes/auction'
import { mintRoutes } from './routes/mint'
import config from './config'
import { initWalletClient, publicClient } from './lib/viem'
import { ContractService } from './services/contract.service'

// ── Unlock keystore before server starts ──────────────────────────────────
console.log('\n🔑 Territory NFT API — starting up')
const { account, walletClient } = await initWalletClient()

// ── Inject into ContractService ───────────────────────────────────────────
const contractService = new ContractService(publicClient, walletClient, account)

const app = new Elysia()
  .use(cors({ origin: true }))
  .use(bearer())
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Territory NFT API',
          version: '1.0.0',
          description:
            'Backend API for the Territory NFT system — NFT minting, marketplace, auction, and game bridge.',
        },
        tags: [
          { name: 'health',       description: 'Health checks' },
          { name: 'nft',          description: 'NFT metadata and ownership queries' },
          { name: 'marketplace',  description: 'Fixed-price marketplace listings' },
          { name: 'auction',      description: 'Auction queries and finalization' },
          { name: 'admin',        description: 'Org admin' },
        ],
      },
    })
  )
  // Global error handler
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') return { success: false, message: 'Not found' }
    if (code === 'VALIDATION') return { success: false, message: 'Validation error' }
    console.error('[API Error]', error)
    return { success: false, message: 'Internal server error' }
  })
  // Health check
  .get(
    '/health',
    () => ({ status: 'ok', chain: 'base-sepolia' }),
    { detail: { tags: ['health'], summary: 'Health check' } }
  )
  // Route groups
  .use(nftRoutes(contractService))
  .use(marketplaceRoutes(contractService))
  .use(auctionRoutes(contractService))
  .use(mintRoutes(contractService))

  .listen(config.port)

console.log(`API at http://localhost:${config.port}`)
console.log(`Docs at http://localhost:${config.port}/docs`)

export type App = typeof app
