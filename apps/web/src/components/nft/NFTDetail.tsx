"use client";

import Image from "next/image";
import Link from "next/link";
import { useAccount, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { Rarity } from "territory-nft-shared";
import { RarityBadge } from "./RarityBadge";
import { PriceHistory } from "./PriceHistory";
import { BuyButton } from "@/components/marketplace/BuyButton";
import { ListingForm } from "@/components/marketplace/ListingForm";
import { CancelListingButton } from "@/components/marketplace/CancelListingButton";
import { LoadingPage } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useNFT } from "@/hooks/useNFT";
import { useListing, useListingHistory } from "@/hooks/useListing";
import { useAuctionHistory } from "@/hooks/useAuction";
import {
  resolveIPFS,
  truncateAddress,
  formatUsdc,
  resolveImageIPFS,
} from "@/lib/utils";
import { useEffect, useState } from "react";
import { ListingAuction } from "../marketplace/ListingAuction";

// import { TokenInfo } from "territory-nft-shared";

interface NFTDetailProps {
  tokenId: string;
}

export function NFTDetail({ tokenId }: NFTDetailProps) {
  const { address } = useAccount();
  const {
    data: token,
    isLoading: tokenLoading,
    isError: tokenError,
  } = useNFT(tokenId);
  const { data: listing } = useListing(tokenId);
  const { data: marketplaceHistory } = useListingHistory(tokenId);
  const { data: auctionHistory } = useAuctionHistory(tokenId);
  const [imageUrl, setImageUrl] = useState("/placeholder.svg");

  const metaDataURL = token?.ipfsCID
    ? resolveIPFS(token.ipfsCID)
    : "/placeholder.svg";

  useEffect(() => {
    resolveImageIPFS(metaDataURL).then((url) => setImageUrl(url));
  }, [metaDataURL]);

  const { data: ownerEns } = useEnsName({
    address: token?.owner,
    chainId: mainnet.id,
  });

  if (tokenLoading) return <LoadingPage />;
  if (tokenError || !token)
    return <ErrorState message="NFT not found or failed to load." />;

  const isOwner = address?.toLowerCase() === token.owner.toLowerCase();
  const isListed = listing?.active === true;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Left — Image */}
      <div className="relative aspect-square rounded-3xl overflow-hidden glass shadow-2xl">
        <Image
          src={imageUrl}
          alt={`Token #${token.tokenId}`}
          fill
          className="object-cover"
          priority
        />
        {token.rarity === Rarity.MYTHIC && (
          <div className="absolute inset-0 bg-gradient-to-t from-orange-900/50 to-transparent" />
        )}
      </div>

      {/* Right — Details */}
      <div className="flex flex-col gap-6">
        {/* Name & Rarity */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <RarityBadge rarity={token.rarity} />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Token #{token.tokenId.toString()}
          </h1>
          <p className="text-zinc-400 mt-1">
            Owned by{" "}
            <Link
              href={`/profile/${token.owner}`}
              className="text-orange-400 hover:underline"
            >
              {ownerEns ?? truncateAddress(token.owner)}
            </Link>
          </p>
        </div>

        {/* Status */}
        <div className="glass rounded-2xl p-5 space-y-4">
          {isListed && listing ? (
            <>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Current Price</p>
                <p className="text-3xl font-bold text-orange-400">
                  {formatUsdc(listing.price)}
                </p>
              </div>
              {!isOwner && (
                <BuyButton tokenId={token.tokenId} price={listing.price} />
              )}
              {isOwner && <CancelListingButton tokenId={token.tokenId} />}
            </>
          ) : isOwner ? (
            <>
              <ListingForm tokenId={token.tokenId} />
              {token.rarity == Rarity.MYTHIC ? (
                <>
                  <div className="pt-10">
                    <div className="flex items-center justify-center h-1 w-full bg-black/80">
                      <p>OR</p>
                    </div>
                    <p className="mt-3">Auction</p>
                  </div>
                  <ListingAuction tokenId={token.tokenId} />
                </>
              ) : (
                ""
              )}
            </>
          ) : (
            <p className="text-zinc-400 italic">
              Not currently listed for sale.
            </p>
          )}
        </div>

        {/* Attributes */}
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Attributes
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { trait: "Rarity Tier", value: token.rarity.toString() },
              {
                trait: "First Listed",
                value: token.firstListed ? "Yes" : "Pending",
              },
            ].map((attr) => (
              <div
                key={attr.trait}
                className="glass rounded-xl p-3 text-center"
              >
                <p className="text-xs text-zinc-500 mb-1">{attr.trait}</p>
                <p className="text-sm font-semibold text-white">{attr.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Price History */}
        {token.rarity === Rarity.MYTHIC ? (
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              Price History
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Marketplace sales</p>
                {marketplaceHistory && marketplaceHistory.length > 0 ? (
                  <PriceHistory
                    history={marketplaceHistory}
                    seriesLabel="Marketplace Sale"
                  />
                ) : (
                  <div className="glass rounded-2xl p-4 text-sm text-zinc-500 italic">
                    No marketplace sale history yet.
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-2">Auction bids</p>
                {auctionHistory && auctionHistory.length > 0 ? (
                  <PriceHistory
                    history={auctionHistory.map((e) => ({
                      price: e.amount,
                      timestamp: e.timestamp,
                    }))}
                    seriesLabel="Auction Bid"
                  />
                ) : (
                  <div className="glass rounded-2xl p-4 text-sm text-zinc-500 italic">
                    No auction bid history yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          marketplaceHistory &&
          marketplaceHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                Marketplace Price History
              </h3>
              <PriceHistory
                history={marketplaceHistory}
                seriesLabel="Marketplace Sale"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
