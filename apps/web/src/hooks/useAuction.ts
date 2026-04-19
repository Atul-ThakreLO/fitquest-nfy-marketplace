"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { api } from "@/lib/api";
import {
  CONTRACT_ADDRESSES,
  AUCTION_ABI,
  NFT_ABI,
  USDC_ABI,
  USDC_DECIMALS,
} from "@/lib/contracts";
import type { Auction, Bid } from "@/types";
import type { AuctionHistoryEvent } from "@/lib/api";

export function useActiveAuctions() {
  return useQuery<Auction[], Error>({
    queryKey: ["auctions", "active"],
    queryFn: () => api.auction.getActive(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useAuction(auctionId: string | undefined) {
  return useQuery<Auction, Error>({
    queryKey: ["auction", auctionId],
    queryFn: () => api.auction.getById(auctionId!),
    enabled: !!auctionId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useAuctionBids(auctionId: string | undefined) {
  return useQuery<Bid[], Error>({
    queryKey: ["auction-bids", auctionId],
    queryFn: () => api.auction.getBids(auctionId!),
    enabled: !!auctionId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useAuctionHistory(tokenId: string | undefined) {
  return useQuery<AuctionHistoryEvent[], Error>({
    queryKey: ["auction-history", tokenId],
    queryFn: () => api.auction.getTokenHistory(tokenId!),
    enabled: !!tokenId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function usePendingReturn(auctionId: bigint | undefined) {
  const { address } = useAccount();

  return useReadContract({
    address: CONTRACT_ADDRESSES.auction,
    abi: AUCTION_ABI,
    functionName: "pendingReturns",
    args: address && auctionId !== undefined ? [address, auctionId] : undefined,
    query: {
      enabled: !!address && auctionId !== undefined,
      refetchInterval: 10_000,
    },
  });
}

export type PlaceBidStep = "idle" | "approving-usdc" | "bidding" | "done";

/**
 * Place a USDC bid on an auction.
 * Steps: 1) approve USDC to auction contract  2) call bid(auctionId, amount)
 *
 * @param bidUsdc - Human-readable USDC bid amount (e.g. "5.00")
 */
export function usePlaceBid() {
  const [step, setStep] = useState<PlaceBidStep>("idle");
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Read current USDC allowance granted to auction contract
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESSES.auction] : undefined,
    query: { enabled: !!address },
  });

  // Read user's USDC balance
  const { data: usdcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const placeBid = async (auctionId: bigint, bidUsdc: string) => {
    if (!address) throw new Error("Wallet not connected");
    const bidAmount = parseUnits(bidUsdc, USDC_DECIMALS);
    toast.loading("Preparing bid…", { id: "bid" });

    try {
      // 1. Pre-flight check: manual auction status check
      const auctionData = (await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "auctions",
        args: [auctionId],
      })) as [string, bigint, bigint, bigint, string, bigint, boolean];

      const [
        seller,
        ,
        startPrice,
        highestBid,
        highestBidder,
        endTime,
        finalized,
      ] = auctionData;
      const now = BigInt(Math.floor(Date.now() / 1000));

      if (finalized || now >= endTime) {
        toast.error("Auction has already ended or been finalized.", {
          id: "bid",
        });
        return;
      }

      if (address.toLowerCase() === seller.toLowerCase()) {
        toast.error("Sellers cannot bid on their own auctions.", { id: "bid" });
        return;
      }

      // 2. Minimum bid check
      let minBid: bigint;
      if (highestBidder === "0x0000000000000000000000000000000000000000") {
        minBid = startPrice;
      } else {
        minBid = highestBid + (highestBid * BigInt(5)) / BigInt(100);
      }

      if (bidAmount < minBid) {
        toast.error(
          `Bid too low. Minimum required: ${minBid / BigInt(10 ** 6)} USDC`,
          { id: "bid" },
        );
        return;
      }

      const currentBalance = usdcBalance ?? BigInt(0);
      if (currentBalance < bidAmount) {
        toast.error("Insufficient USDC balance to place this bid.", {
          id: "bid",
        });
        setStep("idle");
        return;
      }

      // 3. Step 1: Approve USDC if allowance is insufficient
      const currentAllowance = allowance ?? BigInt(0);
      if (currentAllowance < bidAmount) {
        setStep("approving-usdc");
        toast.loading("Step 1/2: Approving USDC…", { id: "bid" });
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.usdc,
          abi: USDC_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.auction, bidAmount],
        });
        if (publicClient)
          await publicClient.waitForTransactionReceipt({ hash });
        await refetchAllowance();
      }

      // 4. Step 2: Place the bid
      setStep("bidding");
      toast.loading("Step 2/2: Placing bid…", { id: "bid" });
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "bid",
        args: [auctionId, bidAmount],
      });

      setStep("done");
      toast.success("Bid placed!", { id: "bid" });
    } catch (err) {
      setStep("idle");
      toast.error("Bid failed", { id: "bid" });
      throw err;
    }
  };

  return { placeBid, step };
}

export function useCreateAuction() {
  const [step, setStep] = useState<"idle" | "approving" | "creating" | "done">(
    "idle",
  );
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Read current approval status for the auction contract
  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "isApprovedForAll",
    args: address ? [address, CONTRACT_ADDRESSES.auction] : undefined,
    query: { enabled: !!address },
  });

  /**
   * @param tokenId         - NFT token ID
   * @param startPriceUsdc - Human-readable starting price (e.g. "50.00")
   * @param durationHours  - Duration in hours
   */
  const createAuction = async (
    tokenId: bigint,
    startPriceUsdc: string,
    durationHours: number,
  ) => {
    if (!address) throw new Error("Wallet not connected");
    if (!publicClient) throw new Error("Public client not ready");
    const startPriceRaw = parseUnits(startPriceUsdc, USDC_DECIMALS);
    const durationSeconds = BigInt(durationHours * 3600);

    try {
      // 1. Pre-flight check: rarity and ownership
      toast.loading("Verifying token requirements…", { id: "auction-create" });
      const rawTokenData = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.nft,
        abi: NFT_ABI,
        functionName: "tokenData",
        args: [tokenId],
      });

      // viem may return tuple-style data for structs/getters; normalize both shapes.
      const tokenData = Array.isArray(rawTokenData)
        ? {
            rarity: Number(rawTokenData[0]),
            firstListed: Boolean(rawTokenData[2]),
          }
        : {
            rarity: Number(
              (rawTokenData as { rarity: bigint | number }).rarity,
            ),
            firstListed: Boolean(
              (rawTokenData as { firstListed: boolean }).firstListed,
            ),
          };

      console.log(rawTokenData);
      if (tokenData.rarity !== 4) {
        // 4 = MYTHIC
        toast.error("Only MYTHIC rarity NFTs can be auctioned.", {
          id: "auction-create",
        });
        return;
      }

      if (!tokenData.firstListed) {
        toast.error(
          "Token must be unlocked (first-listed) before it can be auctioned.",
          { id: "auction-create" },
        );
        return;
      }

      // 2. Step 1: Approve NFT if not already approved for all
      if (!isApprovedForAll) {
        setStep("approving");
        toast.loading("Step 1/2: Authorizing Auction Contract…", {
          id: "auction-create",
        });
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESSES.nft,
          abi: NFT_ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACT_ADDRESSES.auction, true],
        });
        if (publicClient)
          await publicClient.waitForTransactionReceipt({ hash });
        await refetchApproval();
      }

      // 3. Step 2: Create the auction
      setStep("creating");
      toast.loading("Step 2/2: Creating auction…", { id: "auction-create" });
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "createAuction",
        args: [tokenId, startPriceRaw, durationSeconds],
      });

      setStep("done");
      toast.success("Auction created!", { id: "auction-create" });
    } catch (err) {
      setStep("idle");
      toast.error("Auction creation failed", { id: "auction-create" });
      throw err;
    }
  };

  return { createAuction, step };
}

export function useFinalizeAuction() {
  const { writeContractAsync } = useWriteContract();

  const finalize = async (auctionId: bigint) => {
    toast.loading("Finalising auction…", { id: "finalize" });
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "finalizeAuction",
        args: [auctionId],
      });
      toast.success("Auction finalised!", { id: "finalize" });
    } catch (err) {
      toast.error("Finalise failed", { id: "finalize" });
      throw err;
    }
  };

  return { finalize };
}

export function useCancelAuction() {
  const { writeContractAsync } = useWriteContract();

  const cancelAuction = async (auctionId: bigint) => {
    toast.loading("Cancelling auction…", { id: "cancel-auction" });
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "cancelAuction",
        args: [auctionId],
      });
      toast.success("Auction cancelled", { id: "cancel-auction" });
    } catch (err) {
      toast.error("Cancel failed", { id: "cancel-auction" });
      throw err;
    }
  };

  return { cancelAuction };
}

export function useWithdrawPendingReturn() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const withdrawPendingReturn = async (auctionId: bigint) => {
    toast.loading("Withdrawing pending return…", { id: "withdraw-pending" });
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.auction,
        abi: AUCTION_ABI,
        functionName: "withdrawPendingReturn",
        args: [auctionId],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Pending return withdrawn", { id: "withdraw-pending" });
    } catch (err) {
      toast.error("Withdraw failed", { id: "withdraw-pending" });
      throw err;
    }
  };

  return { withdrawPendingReturn };
}
