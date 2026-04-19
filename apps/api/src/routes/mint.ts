import { Elysia, t } from 'elysia'
import { authMiddleware } from '../middleware/auth'
import { pinataService } from '../services/pinata.service'
import type { ContractService } from '../services/contract.service'
import { randomUUID } from 'crypto'
import type { Rarity } from 'territory-nft-shared'
import { parseEventLogs } from 'viem'

const TOKEN_MINTED_ABI = [{
  type: 'event',
  name: 'TokenMinted',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'rarity', type: 'uint8', indexed: false },
  ],
}] as const

const mintJobs = new Map<string, {
  id: string
  status: 'pending' | 'uploading' | 'minting' | 'done' | 'failed'
  rarity: number
  pinataCID?: string
  txHash?: string
  tokenId?: string
  errorMsg?: string
  createdAt: Date
}>()

export const mintRoutes = (contractService: ContractService) => new Elysia({ prefix: '/admin', tags: ['admin'] })
  .use(authMiddleware)

  // POST /admin/mint — full mint pipeline
  .post(
    '/mint',
    async ({ body, status }) => {
      const jobId = randomUUID()
      mintJobs.set(jobId, {
        id: jobId,
        status: 'pending',
        rarity: body.rarity,
        createdAt: new Date(),
      })

      const updateJob = (
        jobStatus: 'pending' | 'uploading' | 'minting' | 'done' | 'failed',
        extra?: Partial<{
          pinataCID: string
          txHash: string
          tokenId: string
          errorMsg: string
        }>
      ) => {
        const job = mintJobs.get(jobId)
        if (job) {
          mintJobs.set(jobId, { ...job, status: jobStatus, ...extra })
        }
      }

      try {
        // Step 1: Decode base64 → Buffer (strip the data URI scheme first)
        const base64Data = body.imageBase64.replace(/^data:image\/\w+(\+xml)?;base64,/, '')
        const imageBuffer = Buffer.from(base64Data, 'base64')

        // Step 2: Upload assets to Pinata
        updateJob('uploading')
        const { metadataCID, imageUrl } = await pinataService.uploadNFTAssets(
          imageBuffer,
          {
            name: body.name,
            description: body.description,
            attributes: body.attributes,
          }
        )

        // Step 3: Update job status to minting
        updateJob('minting', { pinataCID: metadataCID })

        // Step 4: Mint token on-chain
        const txHash = await contractService.mintToken(
          body.minterAddress as `0x${string}`,
          body.rarity as Rarity,
          metadataCID
        )

        // Step 5: Wait for receipt
        const receipt = await contractService.waitForTransaction(txHash)

        // Step 6: Parse TokenMinted event from logs
        const logs = parseEventLogs({
          abi: TOKEN_MINTED_ABI,
          logs: receipt.logs,
          eventName: 'TokenMinted',
        })

        if (!logs.length) {
          throw new Error('Could not find TokenMinted event in transaction receipt.')
        }

        const tokenId: bigint = logs[0].args.tokenId

        // Step 7: Mark job as done
        updateJob('done', { txHash, tokenId: tokenId.toString() })

        // Step 8: Mark first listed on the NFT contract
        const firstListedTx = await contractService.markFirstListed(tokenId)
        await contractService.waitForTransaction(firstListedTx)

        // Step 9: Create listing
        const listTx = await contractService.createListing(tokenId, body.listPrice)
        await contractService.waitForTransaction(listTx)

        // Step 10: Return result
        return {
          success: true,
          data: {
            jobId,
            tokenId: tokenId.toString(),
            txHash,
            imageUrl,
            metadataCID,
          },
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        updateJob('failed', { errorMsg })
        return status(500, { success: false, message: errorMsg })
      }
    },
    {
      body: t.Object({
        rarity: t.Union([t.Literal(0), t.Literal(1), t.Literal(2), t.Literal(3), t.Literal(4)]),
        minterAddress: t.String(),
        imageBase64: t.String(),
        name: t.String(),
        description: t.String(),
        attributes: t.Array(
          t.Object({ trait_type: t.String(), value: t.Union([t.String(), t.Number()]) })
        ),
        listPrice: t.String(),
      }),
      detail: { summary: 'Full mint pipeline: upload to IPFS → mint NFT → first list → create listing' },
    }
  )

  // GET /admin/mint-jobs — list all mint jobs
  .get(
    '/mint-jobs',
    async () => {
      const jobs = Array.from(mintJobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      return {
        success: true,
        data: jobs,
      }
    },
    {
      detail: { summary: 'List all mint jobs with their statuses' },
    }
  )

  // GET /admin/mint-jobs/:id — single mint job status
  .get(
    '/mint-jobs/:id',
    async ({ params, status }) => {
      const job = mintJobs.get(params.id)

      if (!job) {
        return status(404, { success: false, message: 'Mint job not found' })
      }

      return {
        success: true,
        data: job,
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: 'Get status of a specific mint job' },
    }
  )
