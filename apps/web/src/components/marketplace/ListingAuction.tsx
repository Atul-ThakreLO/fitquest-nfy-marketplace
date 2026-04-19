"use client";

import { useState } from "react";
import { useCreateAuction } from "@/hooks/useAuction";

interface ListingAuctionProps {
  tokenId: bigint;
}

export function ListingAuction({ tokenId }: ListingAuctionProps) {
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState<number>();

  const {createAuction, step} = useCreateAuction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price) return;
    await createAuction(tokenId, price, duration!);
  };

  const isProcessing = step === "approving" || step === "creating";

  const stepLabel: Record<typeof step, string> = {
    idle: "List for Auction",
    approving: "Step 1/2: Approving NFT…",
    creating: "Step 2/2: Creating creating...",
    done: "✓ Listed!",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          className="block text-xs text-zinc-400 mb-1.5"
          htmlFor="listing-price"
        >
          Auction Starting Price (USDC)
        </label>
        <input
          id="listing-price"
          type="number"
          step="1"
          min="1"
          placeholder="10"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={isProcessing || step === "done"}
          className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-colors disabled:opacity-50"
        />
      </div>

      <label
        className="block text-xs text-zinc-400 mb-1.5"
        htmlFor="listing-price"
      >
        Duration in Hrs
      </label>
      <input
        id="listing-price"
        type="number"
        step="1"
        min="1"
        placeholder="1"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        disabled={isProcessing || step === "done"}
        className="w-full bg-white/5 border border-white/10 focus:border-orange-400 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-colors disabled:opacity-50"
      />

      {/* Progress indicator */}
      {isProcessing && (
        <div className="flex gap-2">
          {["approving", "listing"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors duration-500 ${
                step === s || (step === "creating" && i === 0)
                  ? "bg-orange-500"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!price || !duration || isProcessing || step === "done"}
        className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        {stepLabel[step]}
      </button>
    </form>
  );
}
