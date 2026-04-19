"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { AuctionCountdown } from "./AuctionCountdown";
import { BidForm } from "./BidForm";
import { LoadingPage } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAuction,
  useAuctionBids,
  useCancelAuction,
  useFinalizeAuction,
  usePendingReturn,
  useWithdrawPendingReturn,
} from "@/hooks/useAuction";
import { useNFT } from "@/hooks/useNFT";
import {
  formatUsdc,
  truncateAddress,
  formatTimestamp,
  resolveIPFS,
  resolveImageIPFS,
} from "@/lib/utils";

interface AuctionRoomProps {
  auctionId: string;
}

export function AuctionRoom({ auctionId }: AuctionRoomProps) {
  const { address } = useAccount();
  const { data: auction, isLoading, isError } = useAuction(auctionId);
  const { data: bids } = useAuctionBids(auctionId);
  const { finalize } = useFinalizeAuction();
  const { cancelAuction } = useCancelAuction();
  const { withdrawPendingReturn } = useWithdrawPendingReturn();
  const { data: pendingReturnRaw, refetch: refetchPendingReturn } =
    usePendingReturn(auction?.auctionId);
  const tokenId = auction?.tokenId?.toString();
  const { data: token } = useNFT(tokenId);
  const [imageUrl, setImageUrl] = useState("/placeholder.svg");

  const metaDataURL = token?.ipfsCID
    ? resolveIPFS(token.ipfsCID)
    : "/placeholder.svg";

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

  if (isLoading) return <LoadingPage />;
  if (isError || !auction) return <ErrorState message="Auction not found." />;

  const isEnded = Date.now() / 1000 > auction.endTime;
  const isWinner =
    auction.highestBidder.toLowerCase() === address?.toLowerCase();
  const isSeller = auction.seller.toLowerCase() === address?.toLowerCase();
  const noBidAddr = "0x0000000000000000000000000000000000000000";
  const hasNoBids =
    auction.highestBidder.toLowerCase() === noBidAddr ||
    (bids?.length ?? 0) === 0;
  const minNextBid =
    auction.highestBidder === noBidAddr
      ? auction.startPrice
      : auction.highestBid + (auction.highestBid * 5n) / 100n;
  const minNextBidExact = `${formatUnits(minNextBid, 6)} USDC`;
  const pendingReturn = (pendingReturnRaw as bigint | undefined) ?? 0n;
  const hasPendingReturn = pendingReturn > 0n;
  const chronologicalBids = bids
    ? [...bids].sort((a, b) => a.blockTimestamp - b.blockTimestamp)
    : [];
  const latestBidsFirst = [...chronologicalBids].reverse();
  const uniqueBidderCount = new Set(
    chronologicalBids.map((bid) => bid.bidder.toLowerCase()),
  ).size;
  const bidderStatsMap = chronologicalBids.reduce<
    Record<string, { bidder: string; highest: bigint; count: number }>
  >((acc, bid) => {
    const key = bid.bidder.toLowerCase();
    const existing = acc[key];
    if (!existing) {
      acc[key] = { bidder: bid.bidder, highest: bid.amount, count: 1 };
      return acc;
    }

    acc[key] = {
      ...existing,
      highest: bid.amount > existing.highest ? bid.amount : existing.highest,
      count: existing.count + 1,
    };
    return acc;
  }, {});
  const topBidders = Object.values(bidderStatsMap)
    .sort((a, b) =>
      a.highest === b.highest
        ? b.count - a.count
        : b.highest > a.highest
          ? 1
          : -1,
    )
    .slice(0, 5);
  const yourBids = address
    ? chronologicalBids.filter(
        (bid) => bid.bidder.toLowerCase() === address.toLowerCase(),
      )
    : [];
  const yourLastBid =
    yourBids.length > 0 ? yourBids[yourBids.length - 1].amount : null;
  const youAreLeading =
    !!address &&
    auction.highestBidder !== noBidAddr &&
    auction.highestBidder.toLowerCase() === address.toLowerCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Left — Image */}
      <div className="relative aspect-square rounded-3xl overflow-hidden glass">
        <Image
          src={imageUrl}
          alt={`Auction #${auction.auctionId}`}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Right — Auction info */}
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-zinc-500 text-sm mb-1">
            Auction #{auction.auctionId.toString()}
          </p>
          <h1 className="text-3xl font-bold text-white">
            Token #{auction.tokenId.toString()}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            by {truncateAddress(auction.seller)}
          </p>
        </div>

        {/* Countdown */}
        {!isEnded && (
          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">
              Time remaining
            </p>
            <AuctionCountdown endTime={auction.endTime} />
          </div>
        )}

        {/* Current bid */}
        <div className="glass rounded-2xl p-5 space-y-2">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">
            {isEnded ? "Winning bid" : "Highest bid"}
          </p>
          {auction.highestBidder !== noBidAddr ? (
            <>
              <p className="text-4xl font-bold text-orange-400">
                {formatUsdc(auction.highestBid)}
              </p>
              <p className="text-sm text-zinc-400">
                by {truncateAddress(auction.highestBidder)}
              </p>
            </>
          ) : (
            <p className="text-zinc-400 italic">No bids yet</p>
          )}
          {!isEnded && (
            <p className="text-xs text-zinc-300">
              Minimum valid bid:{" "}
              <span className="text-orange-300">{minNextBidExact}</span>
            </p>
          )}
        </div>

        {/* Seller insights */}
        {isSeller && !isEnded && !auction.finalized && (
          <div className="glass rounded-2xl p-5 space-y-4">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">
              Seller dashboard
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-[11px] text-zinc-400">Total bids</p>
                <p className="text-lg font-semibold text-white">
                  {chronologicalBids.length}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-[11px] text-zinc-400">Unique bidders</p>
                <p className="text-lg font-semibold text-white">
                  {uniqueBidderCount}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-[11px] text-zinc-400">Opening price</p>
                <p className="text-sm font-semibold text-white">
                  {formatUsdc(auction.startPrice)}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 px-3 py-2">
                <p className="text-[11px] text-zinc-400">Minimum valid bid</p>
                <p className="text-sm font-semibold text-white">
                  {minNextBidExact}
                </p>
              </div>
            </div>

            {auction.highestBidder !== noBidAddr ? (
              <p className="text-xs text-zinc-300">
                Leading bidder:{" "}
                <span className="text-orange-300">
                  {truncateAddress(auction.highestBidder)}
                </span>
              </p>
            ) : (
              <p className="text-xs text-zinc-400 italic">
                No bidders yet. Once bids arrive, leader insights show here.
              </p>
            )}

            {hasNoBids && (
              <button
                onClick={() => {
                  const confirmed = window.confirm(
                    "Cancel this auction? This will return the NFT to your wallet.",
                  );
                  if (!confirmed) return;
                  cancelAuction(auction.auctionId);
                }}
                id={`cancel-auction-${auction.auctionId}`}
                className="w-full py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold rounded-xl transition-colors"
              >
                Cancel Auction (No Bids)
              </button>
            )}

            {topBidders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 uppercase tracking-widest">
                  Top bidders
                </p>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {topBidders.map((entry, index) => (
                    <div
                      key={entry.bidder}
                      className="grid grid-cols-[44px_1fr_auto] items-center gap-3 bg-white/5 px-3 py-2 text-sm not-last:border-b not-last:border-white/10"
                    >
                      <span className="text-zinc-400">#{index + 1}</span>
                      <span className="text-zinc-200">
                        {truncateAddress(entry.bidder)}
                      </span>
                      <span className="font-medium text-white">
                        {formatUsdc(entry.highest, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bidder insights */}
        {!isSeller && !isEnded && !auction.finalized && (
          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">
              Your bidding status
            </p>

            {!address && (
              <p className="text-sm text-zinc-400">
                Connect your wallet to place a bid.
              </p>
            )}

            {address && youAreLeading && (
              <p className="text-sm text-green-400 font-medium">
                You are currently leading this auction.
              </p>
            )}

            {address && !youAreLeading && yourLastBid !== null && (
              <p className="text-sm text-zinc-300">
                You were outbid. Place a new total bid of at least{" "}
                <span className="text-orange-300">{minNextBidExact}</span> to
                lead again.
              </p>
            )}

            {address && yourLastBid === null && (
              <p className="text-sm text-zinc-300">
                You have not bid yet. Minimum valid bid is{" "}
                <span className="text-orange-300">
                  {formatUsdc(minNextBid)}
                </span>
                .
              </p>
            )}
          </div>
        )}

        {!!address && hasPendingReturn && (
          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">
              Pending Return
            </p>
            <p className="text-sm text-zinc-300">
              Withdrawable now:{" "}
              <span className="text-orange-300">
                {formatUsdc(pendingReturn)}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              This does not reduce your current highest bid. It only withdraws
              older outbid amounts.
            </p>
            <button
              onClick={async () => {
                await withdrawPendingReturn(auction.auctionId);
                await refetchPendingReturn();
              }}
              id={`withdraw-pending-${auction.auctionId}`}
              className="w-full py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
            >
              Withdraw Pending Return
            </button>
          </div>
        )}

        {/* Actions */}
        {!isEnded && !auction.finalized && !isSeller && (
          <BidForm
            auctionId={auction.auctionId}
            highestBid={auction.highestBid}
            startPrice={auction.startPrice}
            highestBidder={auction.highestBidder}
          />
        )}

        {isEnded && !auction.finalized && (
          <div className="glass rounded-2xl p-5 space-y-3">
            {isWinner && (
              <p className="text-green-400 font-semibold">
                🏆 You won this auction!
              </p>
            )}
            {isSeller && hasNoBids && (
              <p className="text-zinc-400">
                No bids received — NFT will be returned to you.
              </p>
            )}
            <button
              onClick={() => finalize(auction.auctionId)}
              id={`finalize-auction-${auction.auctionId}`}
              className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl transition-colors"
            >
              Finalize Auction
            </button>
          </div>
        )}

        {auction.finalized && (
          <div className="glass rounded-2xl p-5">
            <p className="text-zinc-400 italic">
              This auction has been finalized.
            </p>
          </div>
        )}

        {/* Bid history */}
        {bids && bids.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
              Bid History
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {latestBidsFirst.map((bid, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm glass rounded-xl px-4 py-2"
                >
                  <span className="text-zinc-400">
                    {truncateAddress(bid.bidder)}
                  </span>
                  <span className="text-white font-medium">
                    {formatUsdc(bid.amount, 2)}
                  </span>
                  <span className="text-zinc-600">
                    {formatTimestamp(bid.blockTimestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
