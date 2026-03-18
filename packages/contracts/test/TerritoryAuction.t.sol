// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryAuction.sol";

contract TerritoryAuctionTest is Test {
    TerritoryNFT     internal nft;
    TerritoryAuction internal auction;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal seller   = makeAddr("seller");
    address internal bidder1  = makeAddr("bidder1");
    address internal bidder2  = makeAddr("bidder2");

    uint256 internal _testNextTokenId = 1;
    uint256 internal constant START    = 1 ether;
    uint256 internal constant DURATION = 1 days;

    function setUp() public {
        nft     = new TerritoryNFT(admin, minter, treasury);
        auction = new TerritoryAuction(address(nft), treasury);
        vm.deal(bidder1, 100 ether);
        vm.deal(bidder2, 100 ether);
        vm.deal(seller,  10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _mintMythic(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        nft.safeMint(to, TerritoryNFT.Rarity.MYTHIC, "QmMythicCID");
        tokenId = _testNextTokenId;
        _testNextTokenId++;

        vm.prank(minter);
        nft.markFirstListed(tokenId);
    }

    function _mintCommon(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        nft.safeMint(to, TerritoryNFT.Rarity.COMMON, "QmCommonCID");
        tokenId = _testNextTokenId;
        _testNextTokenId++;

        vm.prank(minter);
        nft.markFirstListed(tokenId);
    }

    function _createAuction(uint256 tokenId) internal returns (uint256 auctionId) {
        vm.prank(seller);
        nft.approve(address(auction), tokenId);

        vm.prank(seller);
        auction.createAuction(tokenId, START, DURATION);

        return auction.auctionCounter();
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    /// @dev Non-MYTHIC tokens cannot be auctioned
    function testCreateAuctionOnlyMythic() public {
        uint256 tokenId = _mintCommon(seller);

        vm.prank(seller);
        nft.approve(address(auction), tokenId);

        vm.prank(seller);
        vm.expectRevert("TerritoryAuction: only MYTHIC tokens");
        auction.createAuction(tokenId, START, DURATION);
    }

    /// @dev Bid below startPrice (when no previous bids) reverts
    function testBidBelowMinimumReverts() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        vm.expectRevert("TerritoryAuction: bid too low");
        auction.bid{value: START - 1}(auctionId);
    }

    /// @dev Second bid must be at least 5% above current highest bid
    function testBidIncrementEnforced() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid{value: START}(auctionId);

        // 4% above — should revert
        uint256 tooLow = START + (START * 4) / 100;
        vm.prank(bidder2);
        vm.expectRevert("TerritoryAuction: bid too low");
        auction.bid{value: tooLow}(auctionId);

        // 5% above — should succeed
        uint256 minNext = START + (START * 5) / 100;
        vm.prank(bidder2);
        auction.bid{value: minNext}(auctionId);

        (,, , uint256 highBid, address highBidder,,) = auction.auctions(auctionId);
        assertEq(highBid, minNext);
        assertEq(highBidder, bidder2);
    }

    /// @dev Bid in the last 10 minutes extends the auction by 10 minutes
    function testAuctionExtensionOnLastMinuteBid() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        // Warp to 5 minutes before end
        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime - 5 minutes);

        vm.prank(bidder1);
        auction.bid{value: START}(auctionId);

        (,,,,, uint256 newEndTime,) = auction.auctions(auctionId);
        // New end time should be ~10 minutes from now (block.timestamp + 10 min)
        assertEq(newEndTime, block.timestamp + 10 minutes);
    }

    /// @dev Full finalization with a winner — royalty paid, seller paid, NFT transferred
    function testFinalizeAuctionWithWinner() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid{value: START}(auctionId);

        // Advance time past end
        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        uint256 sellerBefore   = seller.balance;
        uint256 treasuryBefore = treasury.balance;

        auction.finalizeAuction(auctionId);

        // NFT transferred to winner
        assertEq(nft.ownerOf(tokenId), bidder1);

        // Royalty paid (5% of START)
        uint256 royalty = START * 500 / 10_000;
        assertEq(treasury.balance, treasuryBefore + royalty);

        // Seller received proceeds
        assertEq(seller.balance, sellerBefore + START - royalty);
    }

    /// @dev Finalization with no bids returns NFT to seller
    function testFinalizeAuctionNoBids() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        auction.finalizeAuction(auctionId);

        assertEq(nft.ownerOf(tokenId), seller);
    }

    /// @dev Outbid participant can withdraw their pending return
    function testWithdrawPendingReturn() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid{value: START}(auctionId);

        uint256 minNext = START + (START * 5) / 100;
        vm.prank(bidder2);
        auction.bid{value: minNext}(auctionId);

        // bidder1 was outbid — should have a pending return
        assertEq(auction.pendingReturns(bidder1, auctionId), START);

        uint256 before = bidder1.balance;
        vm.prank(bidder1);
        auction.withdrawPendingReturn(auctionId);

        assertEq(bidder1.balance, before + START);
        assertEq(auction.pendingReturns(bidder1, auctionId), 0);
    }

    /// @dev Seller can cancel an auction with no bids, recovering their NFT
    function testCancelAuctionNoBids() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(seller);
        auction.cancelAuction(auctionId);

        assertEq(nft.ownerOf(tokenId), seller);
    }

    /// @dev Cancel reverts once any bid has been placed
    function testCancelAuctionWithBidsReverts() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid{value: START}(auctionId);

        vm.prank(seller);
        vm.expectRevert("TerritoryAuction: bids already placed");
        auction.cancelAuction(auctionId);
    }
}
