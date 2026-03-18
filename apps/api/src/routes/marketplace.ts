import { Elysia, t } from 'elysia'
import type { ContractService } from '../services/contract.service'
import { graphService } from '../services/graph.service'
import { getCache, setCache, invalidateCachePattern } from '../lib/redis'

export const marketplaceRoutes = (contractService: ContractService) => new Elysia({ prefix: '/marketplace', tags: ['marketplace'] })

  // GET /marketplace/listings?skip=0&take=20 — all active listings (paginated)
  .get(
    '/listings',
    async ({ query, status }) => {
      try {
        const skip = Number(query.skip ?? 0)
        const take = Math.min(Number(query.take ?? 20), 100)
        const rarity = query.rarity !== undefined ? Number(query.rarity) : undefined
        const sort = query.sort ? String(query.sort) : 'createdAt'
        
        const cacheKey = `listings:active:${skip}:${take}:${rarity ?? 'all'}:${sort}`
        const cached = await getCache<any[]>(cacheKey)
        if (cached) {
          return { success: true, data: cached }
        }

        const listings = await graphService.getActiveListings(skip, take, rarity, sort)

        const responseData = listings.map((l) => ({
          ...l,
          tokenId: l.tokenId.toString(),
          price: l.price.toString(),
        }))

        // Cache for 30 seconds
        await setCache(cacheKey, responseData, 30)

        return {
          success: true,
          data: responseData,
        }
      } catch {
        return status(500, { success: false, message: 'Failed to fetch listings' })
      }
    },
    {
      query: t.Object({
        skip: t.Optional(t.String()),
        take: t.Optional(t.String()),
        rarity: t.Optional(t.String()),
        sort: t.Optional(t.String()),
      }),
      detail: { summary: 'Get all active marketplace listings (paginated, cached)' },
    }
  )

  // POST /marketplace/webhook — receive events to invalidate cache
  .post(
    '/webhook',
    async ({ body, status }) => {
      try {
        const { event } = body as { event: string }
        if (['Listed', 'Sold', 'Cancelled'].includes(event)) {
          await invalidateCachePattern('listings:active:*')
        }
        return { success: true }
      } catch {
        return status(500, { success: false, message: 'Failed to process webhook' })
      }
    },
    {
      body: t.Object({
        event: t.String()
      }),
      detail: { summary: 'Webhook to invalidate active listings cache' },
    }
  )

  // GET /marketplace/listings/:tokenId — single listing
  .get(
    '/listings/:tokenId',
    async ({ params, status }) => {
      try {
        const tokenId = BigInt(params.tokenId)
        const listing = await contractService.getListing(tokenId)

        if (!listing.active) {
          return status(404, { success: false, message: 'No active listing for this token' })
        }

        return {
          success: true,
          data: {
            ...listing,
            tokenId: listing.tokenId.toString(),
            price: listing.price.toString(),
          },
        }
      } catch {
        return status(404, { success: false, message: 'Listing not found' })
      }
    },
    {
      params: t.Object({ tokenId: t.String() }),
      detail: { summary: 'Get active listing for a specific token' },
    }
  )

  // GET /marketplace/history/:tokenId — sale history from The Graph
  .get(
    '/history/:tokenId',
    async ({ params, status }) => {
      try {
        const tokenId = BigInt(params.tokenId)
        const history = await graphService.getTokenHistory(tokenId)

        return {
          success: true,
          data: history.map((h) => ({
            ...h,
            price: h.price.toString(),
          })),
        }
      } catch {
        return status(500, { success: false, message: 'Failed to fetch token history' })
      }
    },
    {
      params: t.Object({ tokenId: t.String() }),
      detail: { summary: 'Get sale and listing history for a token from The Graph' },
    }
  )
