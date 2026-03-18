import { Elysia, t } from 'elysia'
import type { ContractService } from '../services/contract.service'
import { graphService } from '../services/graph.service'

export const nftRoutes = (contractService: ContractService) => new Elysia({ prefix: '/nft', tags: ['nft'] })

  // GET /nft/:tokenId — token metadata + owner + listing status
  .get(
    '/:tokenId',
    async ({ params, status }) => {
      try {
        const tokenId = BigInt(params.tokenId)
        const [tokenInfo, listing] = await Promise.all([
          contractService.getTokenData(tokenId),
          contractService.getListing(tokenId).catch(() => null),
        ])

        return {
          success: true,
          data: {
            ...tokenInfo,
            tokenId: tokenInfo.tokenId.toString(),
            listing: listing?.active
              ? {
                  seller: listing.seller,
                  price: listing.price.toString(),
                  active: listing.active,
                }
              : null,
          },
        }
      } catch {
        return status(404, { success: false, message: 'Token not found' })
      }
    },
    {
      params: t.Object({ tokenId: t.String() }),
      detail: { summary: 'Get token metadata, owner, and listing status' },
    }
  )


  // GET /nft/owner/:wallet — all tokens owned by wallet
  .get(
    '/owner/:wallet',
    async ({ params, status }) => {
      try {
        const tokenIds = await graphService.getTokensByOwner(params.wallet)
        const tokens = await Promise.all(
          tokenIds.map((id) => contractService.getTokenData(id))
        )

        return {
          success: true,
          data: tokens.map((tok) => ({
            ...tok,
            tokenId: tok.tokenId.toString(),
          })),
        }
      } catch {
        return status(500, { success: false, message: 'Failed to fetch tokens' })
      }
    },
    {
      params: t.Object({ wallet: t.String() }),
      detail: { summary: 'Get all tokens owned by a wallet address' },
    }
  )
