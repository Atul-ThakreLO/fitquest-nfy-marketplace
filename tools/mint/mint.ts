#!/usr/bin/env bun

/**
 * NFT Minting CLI — FitQuest Admin Tool
 * Bun + TypeScript. Uses inquirer for prompts.
 * Admin token: ADMIN_TOKEN env var, or prompted securely at runtime.
 */

import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { existsSync, readFileSync } from 'fs'
import { resolve, extname } from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttributeRow {
  trait_type: string
  value: string
}

type MintStatus = 'pending' | 'uploading' | 'minting' | 'done' | 'error'

interface JobStatusData {
  status: MintStatus
  tokenId?: string
  error?: string
}

interface MintJobResponse {
  success: boolean
  message?: string
  data?: { jobId: string }
}

interface MintApiPayload {
  rarity: number
  minterAddress: string,
  name: string
  description: string
  imageBase64: string
  listPrice: string
  attributes: AttributeRow[]
}

/** Internal working state — fields prefixed with _ are stripped before sending to API */
interface MintPayload extends MintApiPayload {
  _imagePath: string | null
  _apiUrl: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_OPTIONS = [
  { name: 'Common     (0)', value: 0 },
  { name: 'Rare       (1)', value: 1 },
  { name: 'Epic       (2)', value: 2 },
  { name: 'Legendary  (3)', value: 3 },
  { name: 'Mythic     (4)', value: 4 },
] as const

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] as const
type ImageExt = (typeof ALLOWED_IMAGE_EXTS)[number]

const MIME_MAP: Record<ImageExt, string> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
  svg: 'svg+xml',
}

const POLL_INTERVAL_MS = 3_000
const DEFAULT_API_URL = 'http://localhost:3001'

const STEP_LABELS: Record<MintStatus, string> = {
  pending: '⏳  Submitted…',
  uploading: '📤  Uploading metadata to IPFS…',
  minting: '⛏   Minting NFT on-chain…',
  done: '✅  Done!',
  error: '❌  Error',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function banner(): void {
  console.log(
    chalk.bold.hex('#f97316')(
      '\n ███╗   ██╗███████╗████████╗    ███╗   ███╗██╗███╗   ██╗████████╗\n' +
      ' ████╗  ██║██╔════╝╚══██╔══╝    ████╗ ████║██║████╗  ██║╚══██╔══╝\n' +
      ' ██╔██╗ ██║█████╗     ██║       ██╔████╔██║██║██╔██╗ ██║   ██║   \n' +
      ' ██║╚██╗██║██╔══╝     ██║       ██║╚██╔╝██║██║██║╚██╗██║   ██║   \n' +
      ' ██║ ╚████║██║        ██║       ██║ ╚═╝ ██║██║██║ ╚████║   ██║   \n' +
      ' ╚═╝  ╚═══╝╚═╝        ╚═╝       ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝  \n'
    )
  )
  console.log(chalk.dim('  Admin NFT Minting CLI  ·  FitQuest\n'))
  console.log(chalk.dim('─'.repeat(60) + '\n'))
}

function imageToBase64(filePath: string): string {
  const resolved = resolve(filePath)

  if (!existsSync(resolved)) {
    throw new Error(`Image file not found: ${resolved}`)
  }

  const ext = extname(resolved).slice(1).toLowerCase()

  if (!(ALLOWED_IMAGE_EXTS as readonly string[]).includes(ext)) {
    throw new Error(
      `Unsupported image type: .${ext}. Allowed: ${ALLOWED_IMAGE_EXTS.join(', ')}`
    )
  }

  const mime = MIME_MAP[ext as ImageExt]
  const data = readFileSync(resolved)
  return `data:image/${mime};base64,${data.toString('base64')}`
}

function sanitize(message: string, token: string): string {
  // Never leak the admin token in any error output
  return message.replaceAll(token, '[REDACTED]')
}

function validateRequired(val: string): true | string {
  return val?.trim().length > 0 ? true : 'This field is required.'
}

function validatePrice(val: string): true | string {
  if (!val || val.trim() === '') return true // optional field
  const n = parseFloat(val)
  if (isNaN(n) || n < 0) return 'Enter a valid non-negative amount (e.g. 10.50)'
  return true
}

function validateAddress(val: string): true | string {
  return /^0x[0-9a-fA-F]{40}$/.test(val.trim()) ? true : 'Enter a valid Ethereum address (0x + 40 hex chars).'
}

function renderSummary(payload: MintPayload, adminToken: string): void {
  const rarityLabel =
    RARITY_OPTIONS.find(r => r.value === payload.rarity)?.name ?? String(payload.rarity)

  console.log('\n' + chalk.bold.white('── NFT Summary ─────────────────────────────────────'))
  console.log(chalk.cyan('  Name:         ') + chalk.white(payload.name))
  console.log(chalk.cyan('  Rarity:       ') + chalk.white(rarityLabel))
  console.log(chalk.cyan('  Description:  ') + chalk.white(payload.description || chalk.dim('(none)')))
  console.log(chalk.cyan('  Image:        ') + chalk.white(payload._imagePath ?? chalk.dim('(no image)')))
  console.log(
    chalk.cyan('  Listing Price:') +
    chalk.white(payload.listPrice ? `${payload.listPrice} USDC` : chalk.dim('(not set)'))
  )
  console.log(chalk.cyan('  Minter:       ') + chalk.white(payload.minterAddress))
  if (payload.attributes.length > 0) {
    console.log(chalk.cyan('  Attributes:'))
    for (const a of payload.attributes) {
      console.log(`    ${chalk.dim('·')} ${chalk.white(a.trait_type)}: ${chalk.yellow(a.value)}`)
    }
  }
  console.log(chalk.cyan('  API URL:      ') + chalk.white(payload._apiUrl))
  console.log(
    chalk.cyan('  Admin Token:  ') +
    (adminToken ? chalk.green('✓ provided (hidden)') : chalk.red('✗ missing'))
  )
  console.log(chalk.bold.white('─────────────────────────────────────────────────────\n'))
}

// ─── Polling ──────────────────────────────────────────────────────────────────

async function pollStatus(apiUrl: string, jobId: string, adminToken: string): Promise<JobStatusData> {
  const spinner = ora({ text: 'Waiting for job to start…', color: 'yellow' }).start()

  return new Promise<JobStatusData>((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/admin/mint-jobs/${jobId}`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })
        if (!res.ok) throw new Error(`Status check returned HTTP ${res.status}`)

        const json = (await res.json()) as { data?: JobStatusData }
        const status = json?.data?.status

        if (status && STEP_LABELS[status]) {
          spinner.text = STEP_LABELS[status]
        }

        if (status === 'done') {
          clearInterval(interval)
          spinner.succeed(chalk.green('NFT minted successfully!'))
          resolve(json.data!)
        } else if (status === 'error') {
          clearInterval(interval)
          spinner.fail(chalk.red('Minting failed on backend.'))
          reject(new Error(json.data?.error ?? 'Unknown backend error'))
        }
      } catch (err) {
        clearInterval(interval)
        spinner.fail('Status polling failed.')
        reject(err)
      }
    }, POLL_INTERVAL_MS)
  })
}

// ─── Attribute Collection ─────────────────────────────────────────────────────

async function collectAttributes(): Promise<AttributeRow[]> {
  const attributes: AttributeRow[] = []
  console.log(chalk.dim('\n  Define custom NFT attributes. Leave trait empty to finish.\n'))

  while (true) {
    const { trait_type } = await inquirer.prompt<{ trait_type: string }>([
      {
        type: 'input',
        name: 'trait_type',
        message: chalk.cyan('  Trait type') + chalk.dim(' (or Enter to finish):'),
      },
    ])

    if (!trait_type.trim()) break

    const { value } = await inquirer.prompt<{ value: string }>([
      {
        type: 'input',
        name: 'value',
        message: chalk.cyan(`  Value for "${trait_type}":`),
        validate: (v: string) => v.trim().length > 0 ? true : 'Value cannot be empty.',
      },
    ])

    attributes.push({ trait_type: trait_type.trim(), value: value.trim() })
    console.log(chalk.green(`    ✓ Added: ${trait_type.trim()} → ${value.trim()}\n`))
  }

  return attributes
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  banner()

  // ── 1. Admin token ───────────────────────────────────────────────────────
  // Bun exposes env via Bun.env (typed) — fall back to process.env for compat
  let adminToken: string = (Bun.env.ADMIN_TOKEN ?? '').trim()

  if (!adminToken) {
    console.log(chalk.yellow('  ⚠  ADMIN_TOKEN not found in environment.\n'))
    const { tokenInput } = await inquirer.prompt<{ tokenInput: string }>([
      {
        type: 'password',
        name: 'tokenInput',
        message: chalk.cyan('  Enter Admin Secret Token:'),
        mask: '●',
        validate: (v: string) => v?.trim().length > 0 ? true : 'Admin token is required.',
      },
    ])
    adminToken = tokenInput.trim()
  } else {
    console.log(chalk.green('  ✓ Admin token loaded from environment.\n'))
  }

  // ── 2. API URL ────────────────────────────────────────────────────────────
  const envApiUrl = (Bun.env.API_URL ?? Bun.env.NEXT_PUBLIC_API_URL ?? '').trim()

  const { apiUrl } = await inquirer.prompt<{ apiUrl: string }>([
    {
      type: 'input',
      name: 'apiUrl',
      message: chalk.cyan('  API URL:'),
      default: envApiUrl || DEFAULT_API_URL,
    },
  ])

  console.log('')

  // ── 3. Core metadata ──────────────────────────────────────────────────────
  const { rarity } = await inquirer.prompt<{ rarity: number }>([
    {
      type: 'list',
      name: 'rarity',
      message: chalk.cyan('  Rarity tier:'),
      choices: RARITY_OPTIONS,
    },
  ])

  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: 'input',
      name: 'name',
      message: chalk.cyan('  NFT Name:'),
      validate: validateRequired,
    },
  ])

  const { description } = await inquirer.prompt<{ description: string }>([
    {
      type: 'input',
      name: 'description',
      message: chalk.cyan('  Description') + chalk.dim(' (optional):'),
    },
  ])

  // ── 4. Image ──────────────────────────────────────────────────────────────
  const { imagePath } = await inquirer.prompt<{ imagePath: string }>([
    {
      type: 'input',
      name: 'imagePath',
      message: chalk.cyan('  Image file path') + chalk.dim(' (leave blank to skip):'),
    },
  ])

  let imageBase64: string | null = null

  if (imagePath?.trim()) {
    try {
      imageBase64 = imageToBase64(imagePath.trim())
      console.log(
        chalk.green(`    ✓ Image encoded (${(imageBase64.length / 1024).toFixed(1)} KB base64)\n`)
      )
    } catch (err) {
      console.log(chalk.red(`    ✗ ${(err as Error).message}\n`))
      const { continueWithout } = await inquirer.prompt<{ continueWithout: boolean }>([
        {
          type: 'confirm',
          name: 'continueWithout',
          message: chalk.yellow('  Continue without an image?'),
          default: false,
        },
      ])
      if (!continueWithout) {
        console.log(chalk.dim('\n  Aborted.\n'))
        process.exit(0)
      }
    }
  }

  // ── 5. Listing price ──────────────────────────────────────────────────────
  const { listingPrice } = await inquirer.prompt<{ listingPrice: string }>([
    {
      type: 'input',
      name: 'listingPrice',
      message: chalk.cyan('  Listing Price (USDC)') + chalk.dim(' (optional, e.g. 10.50):'),
      validate: validatePrice,
    },
  ])

  const { minterAddress } = await inquirer.prompt<{ minterAddress: string }>([
    {
      type: 'input',
      name: 'minterAddress',
      message: chalk.cyan('  Minter Address') + chalk.dim(' (0x…):'),
      validate: validateAddress,
    },
  ])

  // ── 6. Attributes ─────────────────────────────────────────────────────────
  const { wantAttributes } = await inquirer.prompt<{ wantAttributes: boolean }>([
    {
      type: 'confirm',
      name: 'wantAttributes',
      message: chalk.cyan('  Add custom attributes?'),
      default: true,
    },
  ])

  const attributes: AttributeRow[] = wantAttributes ? await collectAttributes() : []

  // ── 7. Review & confirm ───────────────────────────────────────────────────
  const payload: MintPayload = {
    rarity,
    name: name.trim(),
    minterAddress: minterAddress.trim(),
    description: description.trim(),
    imageBase64: imageBase64 ?? '',
    listPrice: listingPrice.trim(),
    attributes,
    _imagePath: imagePath?.trim() || null,
    _apiUrl: apiUrl.trim(),
  }

  renderSummary(payload, adminToken)

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.bold.yellow('  ✦ Confirm and mint this NFT?'),
      default: false,
    },
  ])

  if (!confirmed) {
    console.log(chalk.dim('\n  Aborted by user.\n'))
    process.exit(0)
  }

  // ── 8. Submit ─────────────────────────────────────────────────────────────
  console.log('')
  const spinner = ora({ text: 'Submitting mint request…', color: 'cyan' }).start()

  const apiPayload: MintApiPayload = {
    rarity: payload.rarity,
    minterAddress: payload.minterAddress,
    name: payload.name,
    description: payload.description,
    imageBase64: payload.imageBase64,
    listPrice: payload.listPrice,
    attributes: payload.attributes,
  }

  let jobId: string

  try {
    const res = await fetch(`${payload._apiUrl}/admin/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`, // token only ever in Authorization header
      },
      body: JSON.stringify(apiPayload),
    })

    if (!res.ok) {
      spinner.fail(`HTTP ${res.status} from backend.`)
      const body = await res.text().catch(() => '')
      console.error(chalk.red('\n  Backend response:\n'), chalk.dim(body.slice(0, 400)))
      process.exit(1)
    }

    const data = (await res.json()) as MintJobResponse
    if (!data.success) throw new Error(data.message ?? 'Backend returned success=false')

    jobId = data.data!.jobId
    spinner.succeed(chalk.green(`Job queued: ${chalk.bold(jobId)}`))
  } catch (err) {
    spinner.fail('Mint submission failed.')
    console.error(chalk.red('\n  Error: ') + sanitize((err as Error).message, adminToken))
    process.exit(1)
  }

  // ── 9. Poll ───────────────────────────────────────────────────────────────
  try {
    const result = await pollStatus(payload._apiUrl, jobId, adminToken)

    const nftContract =
      Bun.env.NFT_CONTRACT_ADDRESS ?? Bun.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ?? null

    const scanUrl = nftContract
      ? `https://sepolia.basescan.org/token/${nftContract}?a=${result.tokenId}`
      : null

    console.log('\n' + chalk.bold.hex('#f97316')('  ✦ NFT MINTED ✦'))
    console.log(chalk.cyan('  Token ID: ') + chalk.white(result.tokenId))
    if (scanUrl) {
      console.log(chalk.cyan('  Explorer: ') + chalk.underline.white(scanUrl))
    }
    console.log('')
  } catch (err) {
    console.error(
      chalk.red('\n  Minting error: ') + sanitize((err as Error).message, adminToken)
    )
    process.exit(1)
  }
}

main().catch(err => {
  console.error(chalk.red('\nFatal: ') + (err as Error).message)
  process.exit(1)
})
