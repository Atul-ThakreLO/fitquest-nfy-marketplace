import { NFTGrid } from '@/components/nft/NFTGrid'

export const metadata = {
  title: 'Marketplace — Territory NFT',
  description: 'Browse and buy Territory NFTs. Conquer the map, one tile at a time.',
}

export default function MarketplacePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
          Territory{' '}
          <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Marketplace
          </span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl">
          Every tile on the map is a unique NFT. Walk, conquer, collect.
        </p>
      </div>

      <NFTGrid />
    </div>
  )
}
