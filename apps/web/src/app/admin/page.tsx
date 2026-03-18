'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/ui/ConnectButton'

const ORG_WALLET = process.env.NEXT_PUBLIC_ORG_WALLET_ADDRESS?.toLowerCase()

const RARITY_OPTIONS = [
  { label: 'Common (0)',    value: 0 },
  { label: 'Rare (1)',      value: 1 },
  { label: 'Epic (2)',      value: 2 },
  { label: 'Legendary (3)', value: 3 },
  { label: 'Mythic (4)',    value: 4 },
]

type MintStatus = 'idle' | 'pending' | 'uploading' | 'minting' | 'done' | 'error'

interface MintJobStatus {
  status: MintStatus
  tokenId?: string
  error?: string
}

interface AttributeRow {
  trait_type: string
  value: string
}

export default function AdminPage() {
  const { address } = useAccount()

  // Auth guard
  const isAuthorized = ORG_WALLET
    ? address?.toLowerCase() === ORG_WALLET
    : !!address // fallback: any connected wallet in dev

  // Mint form state
  const [rarity, setRarity]           = useState(0)
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState('')
  const [listingPrice, setListingPrice] = useState('')
  const [attributes, setAttributes]   = useState<AttributeRow[]>([
    { trait_type: 'Element', value: '' },
    { trait_type: 'Difficulty', value: '' },
  ])

  // Job state
  const [jobStatus, setJobStatus] = useState<MintJobStatus>({ status: 'idle' })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setImageBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  const addAttribute = () =>
    setAttributes(a => [...a, { trait_type: '', value: '' }])

  const removeAttribute = (i: number) =>
    setAttributes(a => a.filter((_, idx) => idx !== i))

  const updateAttribute = (i: number, field: keyof AttributeRow, val: string) =>
    setAttributes(a => a.map((row, idx) => idx === i ? { ...row, [field]: val } : row))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setJobStatus({ status: 'pending' })

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/admin/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          rarity,
          name,
          description,
          imageBase64,
          attributes: attributes.filter(a => a.trait_type && a.value),
          listingPrice,
        }),
      })
      const data = await res.json()

      if (!data.success) throw new Error(data.message)

      // Poll status
      setJobStatus({ status: 'uploading' })
      const poll = setInterval(async () => {
        const r = await fetch(`${apiUrl}/admin/mint/${data.data.jobId}/status`)
        const s = await r.json()
        if (s.data?.status === 'done') {
          clearInterval(poll)
          setJobStatus({ status: 'done', tokenId: s.data.tokenId })
        } else if (s.data?.status === 'error') {
          clearInterval(poll)
          setJobStatus({ status: 'error', error: s.data.error })
        } else {
          setJobStatus({ status: s.data?.status ?? 'minting' })
        }
      }, 3000)
    } catch (err) {
      setJobStatus({ status: 'error', error: (err as Error).message })
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center">
        <p className="text-zinc-400 text-lg">Connect your wallet to access the admin panel.</p>
        <ConnectButton />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <span className="text-5xl">🔒</span>
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-zinc-400">This panel is restricted to the organisation wallet.</p>
      </div>
    )
  }

  const isProcessing = ['pending', 'uploading', 'minting'].includes(jobStatus.status)

  const STEP_LABELS: Record<MintStatus, string> = {
    idle:      '',
    pending:   '⏳ Submitting…',
    uploading: '📤 Uploading to IPFS…',
    minting:   '⛏ Minting NFT on-chain…',
    done:      '✅ Minted!',
    error:     '❌ Error',
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-zinc-400 mt-1">Mint new Territory NFTs and manage first-listings.</p>
      </div>

      {/* Mint form */}
      <section className="glass rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Mint New NFT</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Rarity</label>
              <select
                value={rarity}
                onChange={e => setRarity(parseInt(e.target.value))}
                className="w-full bg-surface-2 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
              >
                {RARITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">NFT Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Image</label>
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 hover:border-orange-400 rounded-xl px-4 py-3 transition-colors">
              <span className="text-zinc-300">📎 {imageFileName || 'Choose image…'}</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
            </label>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Listing Price (ETH)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={listingPrice}
              onChange={e => setListingPrice(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
            />
          </div>

          {/* Attributes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-400">Attributes</label>
              <button type="button" onClick={addAttribute} className="text-xs text-orange-400 hover:text-orange-300">+ Add</button>
            </div>
            <div className="space-y-2">
              {attributes.map((attr, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Trait type"
                    value={attr.trait_type}
                    onChange={e => updateAttribute(i, 'trait_type', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                  <input
                    placeholder="Value"
                    value={attr.value}
                    onChange={e => updateAttribute(i, 'value', e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                  <button type="button" onClick={() => removeAttribute(i)} className="text-zinc-500 hover:text-red-400 text-sm px-2">✕</button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            id="admin-mint-submit"
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {isProcessing ? STEP_LABELS[jobStatus.status] : 'Mint NFT'}
          </button>
        </form>

        {/* Status */}
        {jobStatus.status !== 'idle' && (
          <div className={`rounded-xl p-4 ${jobStatus.status === 'error' ? 'bg-red-900/20 border border-red-500/30' : 'bg-green-900/20 border border-green-500/30'}`}>
            <p className="text-sm font-medium text-white">{STEP_LABELS[jobStatus.status]}</p>
            {jobStatus.tokenId && (
              <a
                href={`https://sepolia.basescan.org/token/${process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS}?a=${jobStatus.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline text-sm"
              >
                View token #{jobStatus.tokenId} on Basescan →
              </a>
            )}
            {jobStatus.error && <p className="text-red-400 text-sm">{jobStatus.error}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
