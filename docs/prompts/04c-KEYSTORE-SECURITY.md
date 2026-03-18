# Prompt 04c — Keystore Security (Foundry cast wallet)

> **Antigravity instruction**: This prompt updates the backend API and the contracts deploy script to use Foundry's encrypted keystore instead of a raw private key. No plaintext private key should exist anywhere — not in any `.env` file, not in any source file, not in any script. Apply all changes described below to the existing codebase.

---

## Context

The minter wallet (used to call `safeMint()` and `markFirstListed()` on-chain) was previously configured using a raw `MINTER_PRIVATE_KEY` env variable. We are replacing this entirely with Foundry's `cast wallet` keystore system. The keystore is an encrypted JSON file stored at `~/.foundry/keystores/<name>` on the developer's machine. The password to unlock it is typed once interactively when the API server boots — it is never stored in any file.

---

## Prerequisites (one-time manual step — do not automate this)

The developer must run this once on their machine before starting the server:

```bash
cast wallet import minter --interactive
# Prompts: Enter private key → Enter password → Confirm password
# Saves encrypted keystore to: ~/.foundry/keystores/minter
```

Verify it worked:
```bash
cast wallet list
# Output should include: minter
```

After this, the raw private key can be deleted from anywhere it was stored. It is never needed again.

---

## Changes to make

### 1. Install new dependency

```bash
cd apps/api
bun add ethers
```

`ethers` is used only for its `Wallet.fromEncryptedJson()` keystore decryption. Viem remains the sole library for all contract interactions.

---

### 2. Replace `apps/api/src/lib/viem.ts` entirely

```typescript
import { createPublicClient, createWalletClient, http, privateKeyToAccount } from 'viem'
import { baseSepolia } from 'viem/chains'
import { Wallet } from 'ethers'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import config from '../config'

// ---------------------------------------------------------------------------
// Password prompt — reads from stdin with character masking, no echo
// ---------------------------------------------------------------------------
async function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write('🔐 Enter keystore password: ')

    let password = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    function handler(char: string) {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        // Enter pressed
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', handler)
        process.stdout.write('\n')
        resolve(password)
      } else if (char === '\u0003') {
        // Ctrl+C — exit cleanly
        process.stdout.write('\nAborted.\n')
        process.exit(1)
      } else if (char === '\u007f') {
        // Backspace
        password = password.slice(0, -1)
      } else {
        password += char
      }
    }

    process.stdin.on('data', handler)
  })
}

// ---------------------------------------------------------------------------
// Keystore loader — reads encrypted JSON, decrypts with password, returns account
// ---------------------------------------------------------------------------
async function loadKeystoreAccount() {
  const keystorePath = join(homedir(), '.foundry', 'keystores', config.keystoreName)

  let keystoreJson: string
  try {
    keystoreJson = readFileSync(keystorePath, 'utf-8')
  } catch {
    console.error(`\n❌ Keystore not found at: ${keystorePath}`)
    console.error(`   Run: cast wallet import ${config.keystoreName} --interactive\n`)
    process.exit(1)
  }

  const password = await promptPassword()

  try {
    const wallet = await Wallet.fromEncryptedJson(keystoreJson, password)
    console.log(`✅ Keystore unlocked — minter address: ${wallet.address}`)
    return privateKeyToAccount(wallet.privateKey as `0x${string}`)
  } catch {
    console.error('\n❌ Wrong password — keystore could not be decrypted\n')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Public client — no signing, safe to create immediately
// ---------------------------------------------------------------------------
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

// ---------------------------------------------------------------------------
// initWalletClient — call once at server startup before accepting requests
// Returns the unlocked account and a walletClient ready for contract writes
// ---------------------------------------------------------------------------
export async function initWalletClient() {
  const account = await loadKeystoreAccount()
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  })
  return { account, walletClient }
}
```

---

### 3. Update `apps/api/src/config.ts`

Remove `minterPrivateKey`. Add `keystoreName`:

```typescript
// REMOVE this line:
// minterPrivateKey: Bun.env.MINTER_PRIVATE_KEY as `0x${string}`,

// ADD this line:
keystoreName: Bun.env.KEYSTORE_NAME ?? 'minter',
```

Update the required env vars validation — remove `MINTER_PRIVATE_KEY` from the required array:

```typescript
// BEFORE:
const required = ['DATABASE_URL','MINTER_PRIVATE_KEY','PINATA_API_KEY', ...]

// AFTER:
const required = ['DATABASE_URL','PINATA_API_KEY', ...]
```

`KEYSTORE_NAME` is optional (defaults to `'minter'`) so it does not need to be in the required array.

---

### 4. Update `apps/api/src/index.ts`

The server must not start accepting requests until the keystore is unlocked. Initialise the wallet client before calling `.listen()` and pass the walletClient and account into ContractService:

```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { bearer } from '@elysiajs/bearer'
import { initWalletClient, publicClient } from './lib/viem'
import { ContractService } from './services/contract.service'
import { nftRoutes } from './routes/nft'
import { marketplaceRoutes } from './routes/marketplace'
import { auctionRoutes } from './routes/auction'
import { mintRoutes } from './routes/mint'
import { gameBridgeRoutes } from './routes/game-bridge'
import config from './config'

// ── Unlock keystore before server starts ──────────────────────────────────
console.log('\n🔑 Territory NFT API — starting up')
const { account, walletClient } = await initWalletClient()

// ── Inject into ContractService ───────────────────────────────────────────
const contractService = new ContractService(publicClient, walletClient, account)

// ── Build app ─────────────────────────────────────────────────────────────
const app = new Elysia()
  .use(cors({ origin: true }))
  .use(bearer())
  .use(swagger({
    path: '/docs',
    documentation: {
      info: { title: 'Territory NFT API', version: '1.0.0' },
    },
  }))
  .get('/health', () => ({
    status: 'ok',
    minter: account.address,
    chain: 'base-sepolia',
  }))
  .use(nftRoutes(contractService))
  .use(marketplaceRoutes(contractService))
  .use(auctionRoutes(contractService))
  .use(mintRoutes(contractService))
  .use(gameBridgeRoutes())
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') return { success: false, message: 'Not found' }
    console.error(error)
    return { success: false, message: 'Internal server error' }
  })
  .listen(config.port)

console.log(`\n🚀 API running at http://localhost:${config.port}`)
console.log(`📖 Docs at http://localhost:${config.port}/docs\n`)

export type App = typeof app
```

---

### 5. Update `apps/api/src/services/contract.service.ts`

Convert from module-level singleton to a class that accepts `walletClient` and `account` via constructor injection:

```typescript
import {
  PublicClient,
  WalletClient,
  Account,
  getContract,
} from 'viem'
import TerritoryNFTAbi from 'territory-nft-shared/abis/TerritoryNFT.json'
import TerritoryMarketplaceAbi from 'territory-nft-shared/abis/TerritoryMarketplace.json'
import TerritoryAuctionAbi from 'territory-nft-shared/abis/TerritoryAuction.json'
import { CONTRACT_ADDRESSES } from 'territory-nft-shared/constants'
import type { Rarity, TokenInfo, Listing, Auction } from 'territory-nft-shared'

export class ContractService {
  private nft
  private marketplace
  private auction

  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient,
    private account: Account,
  ) {
    this.nft = getContract({
      address: CONTRACT_ADDRESSES.nft,
      abi: TerritoryNFTAbi,
      client: { public: publicClient, wallet: walletClient },
    })
    this.marketplace = getContract({
      address: CONTRACT_ADDRESSES.marketplace,
      abi: TerritoryMarketplaceAbi,
      client: { public: publicClient, wallet: walletClient },
    })
    this.auction = getContract({
      address: CONTRACT_ADDRESSES.auction,
      abi: TerritoryAuctionAbi,
      client: { public: publicClient, wallet: walletClient },
    })
  }

  // ── NFT reads ─────────────────────────────────────────────────────────────
  async getTokenData(tokenId: bigint): Promise<TokenInfo> {
    return this.nft.read.getTokenData([tokenId]) as Promise<TokenInfo>
  }

  async getTokenByRegion(regionId: number): Promise<bigint> {
    return this.nft.read.getTokenByRegion([regionId]) as Promise<bigint>
  }

  async ownerOf(tokenId: bigint): Promise<`0x${string}`> {
    return this.nft.read.ownerOf([tokenId]) as Promise<`0x${string}`>
  }

  // ── NFT writes (minter wallet) ────────────────────────────────────────────
  async mintToken(
    to: `0x${string}`,
    rarity: Rarity,
    regionId: number,
    ipfsCID: string,
  ): Promise<`0x${string}`> {
    return this.nft.write.safeMint([to, rarity, regionId, ipfsCID]) as Promise<`0x${string}`>
  }

  async markFirstListed(tokenId: bigint): Promise<`0x${string}`> {
    return this.nft.write.markFirstListed([tokenId]) as Promise<`0x${string}`>
  }

  // ── Marketplace reads ─────────────────────────────────────────────────────
  async getListing(tokenId: bigint): Promise<Listing> {
    return this.marketplace.read.getListing([tokenId]) as Promise<Listing>
  }

  // ── Auction reads ─────────────────────────────────────────────────────────
  async getAuction(auctionId: bigint): Promise<Auction> {
    return this.auction.read.getAuction([auctionId]) as Promise<Auction>
  }

  async finalizeAuction(auctionId: bigint): Promise<`0x${string}`> {
    return this.auction.write.finalizeAuction([auctionId]) as Promise<`0x${string}`>
  }

  // ── Shared utility ────────────────────────────────────────────────────────
  async waitForTransaction(txHash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash: txHash })
  }
}
```

---

### 6. Update `apps/api/.env` — remove private key

The final `.env` for the API. `MINTER_PRIVATE_KEY` is completely gone:

```env
# ── Database (matches docker-compose.dev.yml) ──────────────────────────────
DATABASE_URL=postgresql://territory:territory_dev@localhost:5432/territory_nft
REDIS_URL=redis://localhost:6379

# ── Keystore ───────────────────────────────────────────────────────────────
# Name of the keystore created via: cast wallet import minter --interactive
# Default is 'minter' — only change if you imported under a different name
KEYSTORE_NAME=minter

# ── Contracts (fill after running forge deploy script) ─────────────────────
NFT_CONTRACT_ADDRESS=
MARKETPLACE_CONTRACT_ADDRESS=
AUCTION_CONTRACT_ADDRESS=

# ── Pinata ─────────────────────────────────────────────────────────────────
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
PINATA_GATEWAY_URL=https://gateway.pinata.cloud

# ── The Graph ──────────────────────────────────────────────────────────────
GRAPH_API_URL=

# ── Game bridge shared secret ──────────────────────────────────────────────
GAME_API_SECRET=
```

---

### 7. Update `packages/contracts/.env` — remove private key

`MINTER_PRIVATE_KEY` is also gone from here. The deploy script uses `--account` CLI flag:

```env
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
BASESCAN_API_KEY=
ADMIN_ADDRESS=
MINTER_ADDRESS=
ORG_TREASURY_ADDRESS=
```

---

### 8. Update deploy command in `packages/contracts/script/Deploy.s.sol`

No changes needed to the Solidity file itself. `vm.startBroadcast()` with no arguments is correct — Foundry reads the signer from the `--account` CLI flag automatically.

The deploy command to document in `packages/contracts/README.md`:

```bash
# Interactive password prompt (recommended)
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --account minter \
  --broadcast \
  --verify \
  -vvvv

# Or with a password file (for CI — file should be chmod 600)
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --account minter \
  --password-file ~/.foundry/keystores/.minter.pass \
  --broadcast \
  --verify \
  -vvvv
```

---

### 9. Add `.gitignore` entries (monorepo root)

```gitignore
# Never commit keystore files if copied locally
*.keystore
.minter.pass

# Foundry keystore path should never be inside the repo
keystores/
```

---

## What startup looks like after this change

```bash
bun run dev:api

  ▶ Starting Docker services...   [done]
  ▶ Starting API...

🔑 Territory NFT API — starting up
🔐 Enter keystore password: ████████
✅ Keystore unlocked — minter address: 0xYourMinterAddress

🚀 API running at http://localhost:3001
📖 Docs at http://localhost:3001/docs
```

The server does not bind to any port until the password is entered and accepted. If the wrong password is entered, the process exits with a clear error message before any port is opened.

---

## Summary of all files changed

| File | Change |
|---|---|
| `apps/api/src/lib/viem.ts` | Full rewrite — keystore decrypt + interactive password prompt |
| `apps/api/src/index.ts` | Call `initWalletClient()` before `.listen()`, inject into ContractService |
| `apps/api/src/services/contract.service.ts` | Converted to class with constructor injection |
| `apps/api/src/config.ts` | Remove `minterPrivateKey`, add `keystoreName` |
| `apps/api/.env` | Remove `MINTER_PRIVATE_KEY`, add `KEYSTORE_NAME` |
| `packages/contracts/.env` | Remove `MINTER_PRIVATE_KEY` |
| `packages/contracts/README.md` | Document new deploy command with `--account minter` flag |
