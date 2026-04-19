"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rarity } from "territory-nft-shared";
import { RarityBadge } from "@/components/nft/RarityBadge";
import { AuctionCountdown } from "./AuctionCountdown";
import { useNFT } from "@/hooks/useNFT";
import {
  formatUsdc,
  truncateAddress,
  resolveIPFS,
  resolveImageIPFS,
} from "@/lib/utils";
import type { Auction } from "@/types";

interface AuctionCardProps {
  auction: Auction;
  ipfsCID?: string;
  rarity?: Rarity;
  name?: string;
}

export function AuctionCard({
  auction,
  ipfsCID,
  rarity = Rarity.MYTHIC,
  name,
}: AuctionCardProps) {
  const [imageUrl, setImageUrl] = useState("/placeholder.svg");
  const { data: token } = useNFT(auction.tokenId.toString());
  const resolvedCid = ipfsCID ?? token?.ipfsCID;
  const metaDataURL = resolvedCid
    ? resolveIPFS(resolvedCid)
    : "/placeholder.svg";
  const isEnded = Date.now() / 1000 > auction.endTime;

  useEffect(() => {
    let mounted = true;
    resolveImageIPFS(metaDataURL)
      .then((url) => {
        if (mounted) setImageUrl(url);
      })
      .catch(() => {
        if (mounted) setImageUrl("/placeholder.svg");
      });

    return () => {
      mounted = false;
    };
  }, [metaDataURL]);

  return (
    <Link
      href={`/auction/${auction.auctionId.toString()}`}
      className="group block glass glass-hover rounded-2xl overflow-hidden transition-all duration-300"
    >
      <div className="relative aspect-video bg-zinc-900 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name ?? `Auction #${auction.auctionId}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {!isEnded && (
          <div className="absolute bottom-2 left-2">
            <AuctionCountdown endTime={auction.endTime} compact />
          </div>
        )}
        {isEnded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white font-semibold bg-white/10 px-3 py-1 rounded-full text-sm">
              Ended
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-white text-sm truncate">
            {name ?? `Token #${auction.tokenId}`}
          </p>
          <RarityBadge rarity={rarity} size="sm" />
        </div>
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Current bid</span>
          <span className="text-orange-400 font-semibold">
            {formatUsdc(auction.highestBid, 2)}
          </span>
        </div>
        {auction.highestBidder !==
          "0x0000000000000000000000000000000000000000" && (
          <p className="text-xs text-zinc-500 mt-1 truncate">
            by {truncateAddress(auction.highestBidder)}
          </p>
        )}
      </div>
    </Link>
  );
}
