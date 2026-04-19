"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { usePlaceBid } from "@/hooks/useAuction";
import { AUCTION_MIN_BID_INCREMENT_PERCENT } from "territory-nft-shared";
import { USDC_DECIMALS } from "@/lib/contracts";

interface BidFormProps {
  auctionId: bigint | number | string;
  highestBid: bigint | number | string;
  startPrice: bigint | number | string;
  highestBidder: string;
}

function toBigIntValue(value: bigint | number | string) {
  return typeof value === "bigint" ? value : BigInt(value);
}

export function BidForm({
  auctionId,
  highestBid,
  startPrice,
  highestBidder,
}: BidFormProps) {
  const normalizedAuctionId = toBigIntValue(auctionId);
  const normalizedHighestBid = toBigIntValue(highestBid);
  const normalizedStartPrice = toBigIntValue(startPrice);
  const noBidder = "0x0000000000000000000000000000000000000000";

  const hasAnyBid = highestBidder.toLowerCase() !== noBidder;
  const minBid = hasAnyBid
    ? normalizedHighestBid +
      (normalizedHighestBid * BigInt(AUCTION_MIN_BID_INCREMENT_PERCENT)) / 100n
    : normalizedStartPrice +
      (normalizedStartPrice * BigInt(AUCTION_MIN_BID_INCREMENT_PERCENT)) / 100n;

  // Keep input at 2 decimals but never below on-chain minimum.
  const microsPerCent = 10_000n;
  const minBidRoundedForInput =
    ((minBid + microsPerCent - 1n) / microsPerCent) * microsPerCent;

  const minBidUsdc = formatUnits(minBidRoundedForInput, USDC_DECIMALS);
  const minBidUsdcExact = formatUnits(minBid, USDC_DECIMALS);

  const [bidAmount, setBidAmount] = useState(minBidUsdc);
  const { placeBid } = usePlaceBid();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await placeBid(normalizedAuctionId, bidAmount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          className="block text-xs text-zinc-400 mb-1.5"
          htmlFor="bid-amount"
        >
          Your bid (USDC) — min {minBidUsdc} USDC
        </label>
        <p className="text-[11px] text-zinc-500 mb-1.5">
          Contract minimum: {minBidUsdcExact} USDC
        </p>
        <input
          id="bid-amount"
          type="number"
          step="0.01"
          min={minBidUsdc}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={
          loading ||
          parseFloat(bidAmount) < parseFloat(minBidUsdc) ||
          !bidAmount
        }
        id={`place-bid-${normalizedAuctionId}`}
        className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        {loading ? "Placing bid…" : "Place Bid"}
      </button>
      <p className="text-xs text-zinc-500 text-center">
        ⚠️ Bidding in the last 10 minutes extends the auction by 10 minutes.
      </p>
    </form>
  );
}
