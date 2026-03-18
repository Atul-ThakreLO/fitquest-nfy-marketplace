import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
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
