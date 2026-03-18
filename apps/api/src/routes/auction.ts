import { Elysia, t } from 'elysia'
import type { ContractService } from '../services/contract.service'
import { graphService } from '../services/graph.service'

export const auctionRoutes = (contractService: ContractService) => new Elysia({ prefix: '/auction', tags: ['auction'] })

  // GET /auction/active — all active auctions
  .get(
    '/active',
    async ({ status }) => {
      try {
        const auctions = await graphService.getActiveAuctions()

        return {
          success: true,
          data: auctions.map((a) => ({
            ...a,
            auctionId: a.auctionId.toString(),
            tokenId: a.tokenId.toString(),
            highestBid: a.highestBid.toString(),
            startPrice: a.startPrice.toString(),
          })),
        }
      } catch {
        return status(500, { success: false, message: 'Failed to fetch active auctions' })
      }
    },
    {
      detail: { summary: 'Get all active (non-finalized) auctions' },
    }
  )

  // GET /auction/:auctionId — single auction detail
  .get(
    '/:auctionId',
    async ({ params, status }) => {
      try {
        const auctionId = BigInt(params.auctionId)
        const auction = await contractService.getAuction(auctionId)

        return {
          success: true,
          data: {
            ...auction,
            auctionId: auction.auctionId.toString(),
            tokenId: auction.tokenId.toString(),
            highestBid: auction.highestBid.toString(),
            startPrice: auction.startPrice.toString(),
          },
        }
      } catch {
        return status(404, { success: false, message: 'Auction not found' })
      }
    },
    {
      params: t.Object({ auctionId: t.String() }),
      detail: { summary: 'Get single auction detail' },
    }
  )

  // GET /auction/:auctionId/bids — bid history
  .get(
    '/:auctionId/bids',
    async ({ params, status }) => {
      try {
        const auctionId = BigInt(params.auctionId)
        const bids = await graphService.getAuctionBids(auctionId)

        return {
          success: true,
          data: bids.map((b) => ({
            ...b,
            auctionId: b.auctionId.toString(),
            amount: b.amount.toString(),
          })),
        }
      } catch {
        return status(500, { success: false, message: 'Failed to fetch bids' })
      }
    },
    {
      params: t.Object({ auctionId: t.String() }),
      detail: { summary: 'Get all bids for an auction' },
    }
  )

  // POST /auction/:auctionId/finalize — trigger finalization (callable by anyone post-deadline)
  .post(
    '/:auctionId/finalize',
    async ({ params, status }) => {
      try {
        const auctionId = BigInt(params.auctionId)
        const auction = await contractService.getAuction(auctionId)

        if (auction.finalized) {
          return status(400, { success: false, message: 'Auction already finalized' })
        }

        if (auction.endTime > Math.floor(Date.now() / 1000)) {
          return status(400, { success: false, message: 'Auction has not ended yet' })
        }

        const txHash = await contractService.finalizeAuction(auctionId)
        await contractService.waitForTransaction(txHash)

        return {
          success: true,
          data: { txHash, auctionId: auctionId.toString() },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to finalize auction'
        return status(500, { success: false, message })
      }
    },
    {
      params: t.Object({ auctionId: t.String() }),
      detail: { summary: 'Trigger auction finalization (callable by anyone after deadline)' },
    }
  )
