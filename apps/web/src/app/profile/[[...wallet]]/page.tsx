'use client'

import { useParams } from 'next/navigation'

import { useAccount, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { NFTCard } from '@/components/nft/NFTCard'
import { LoadingPage } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useOwnedNFTs } from '@/hooks/useOwnedNFTs'
import { truncateAddress } from '@/lib/utils'

export default function ProfilePage() {
  const { address } = useAccount()
  const { wallet } = useParams<{ wallet: string }>()
  const { data: nfts, isLoading, isError, refetch } = useOwnedNFTs(wallet || address)

  console.log("nfts", nfts)
  const { data: ensName } = useEnsName({
    address: (wallet || address) as `0x${string}`,
    chainId: mainnet.id,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Profile header */}
      <div className="glass rounded-3xl p-8 flex items-center gap-6">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
          {wallet?.slice(2, 4).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {ensName ?? truncateAddress(wallet)}
          </h1>
          <p className="text-zinc-500 text-sm font-mono">{wallet}</p>
          <p className="text-zinc-400 text-sm mt-1">
            {nfts?.length ?? 0} NFT{nfts?.length !== 1 ? 's' : ''} owned
          </p>
        </div>
      </div>

      {/* Owned NFTs */}
      <section>
        <h2 className="text-xl font-bold text-white mb-5">Owned NFTs</h2>
        {isLoading ? (
          <LoadingPage />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !nfts?.length ? (
          <EmptyState
            title="No NFTs yet"
            description="This wallet hasn't conquered any territories yet."
            icon="🗺️"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {nfts.map(token => (
              <NFTCard key={token.tokenId.toString()} token={token} />
            ))}
          </div>
        )}
      </section>


    </div>
  )
}
