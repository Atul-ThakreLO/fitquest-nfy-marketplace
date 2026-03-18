'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Rarity } from 'territory-nft-shared'
import { RarityBadge } from './RarityBadge'
import { RARITY_GLOW } from '@/constants/rarity'
import { resolveIPFS, formatEth, resolveImageIPFS } from '@/lib/utils'
import type { TokenInfo, Listing } from '@/types'
import { useEffect, useState } from 'react'
import { useNFT } from '@/hooks/useNFT'

interface NFTCardProps {
  token: TokenInfo
  listing?: Listing
  metadata?: { name: string; image: string }
}

export function NFTCard({ token, listing, metadata }: NFTCardProps) {
  const [imageUrl, setImageUrl] = useState('/placeholder.svg')
  const { data: tokenData} = useNFT(token.tokenId.toString());
  const metaDataURL = tokenData?.ipfsCID
    ? resolveIPFS(tokenData.ipfsCID)
    : '/placeholder.svg'
  useEffect(() => {
    resolveImageIPFS(metaDataURL).then((url) => setImageUrl(url))
  }, [metaDataURL]);

  return (
    <Link
      href={`/nft/${token.tokenId.toString()}`}
      className={`group block rounded-2xl glass glass-hover overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ${RARITY_GLOW[token.rarity]}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-zinc-900">
        <Image
          src={imageUrl}
          alt={metadata?.name ?? `Token #${token.tokenId}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {token.rarity === Rarity.MYTHIC && (
          <div className="absolute inset-0 bg-gradient-to-t from-orange-900/40 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-white text-sm leading-tight truncate">
            {metadata?.name ?? `Token #${token.tokenId}`}
          </p>
          <RarityBadge rarity={token.rarity} size="sm" />
        </div>

        {listing ? (
          <p className="text-sm font-bold text-orange-400">{formatEth(listing.price, 3)}</p>
        ) : (
          <p className="text-xs text-zinc-600 italic">Not listed</p>
        )}
      </div>
    </Link>
  )
}
