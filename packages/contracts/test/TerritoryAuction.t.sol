// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryAuction.sol";
import "../src/MockUSDC.sol";

contract NoReceiverContract {}

contract TerritoryAuctionTest is Test {
    TerritoryNFT     internal nft;
    TerritoryAuction internal auction;
    MockUSDC         internal usdc;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal seller   = makeAddr("seller");
    address internal bidder1  = makeAddr("bidder1");
    address internal bidder2  = makeAddr("bidder2");

    uint256 internal _testNextTokenId = 1;
    uint256 internal constant START    = 1_000_000;
    uint256 internal constant DURATION = 1 days;

    function setUp() public {
        usdc    = new MockUSDC();
        nft     = new TerritoryNFT(admin, minter, treasury);
        auction = new TerritoryAuction(address(nft), address(usdc), treasury);

        usdc.mint(bidder1, 100_000_000);
        usdc.mint(bidder2, 100_000_000);
        usdc.mint(seller,  10_000_000);

        vm.prank(bidder1);
        usdc.approve(address(auction), type(uint256).max);
        vm.prank(bidder2);
        usdc.approve(address(auction), type(uint256).max);
    }

    function _mintMythic(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        nft.safeMint(to, TerritoryNFT.Rarity.MYTHIC, "QmMythicCID");
        tokenId = _testNextTokenId++;
        vm.prank(minter);
        nft.markFirstListed(tokenId);
    }

    function _mintCommon(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        nft.safeMint(to, TerritoryNFT.Rarity.COMMON, "QmCommonCID");
        tokenId = _testNextTokenId++;
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

    function testCreateAuctionOnlyMythic() public {
        uint256 tokenId = _mintCommon(seller);
        vm.prank(seller);
        nft.approve(address(auction), tokenId);

        vm.prank(seller);
        vm.expectRevert(TerritoryAuction.OnlyMythicTokens.selector);
        auction.createAuction(tokenId, START, DURATION);
    }

    function testBidBelowMinimumReverts() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(TerritoryAuction.BidTooLow.selector, START, START - 1));
        auction.bid(auctionId, START - 1);
    }

    function testBidIncrementEnforced() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        uint256 tooLow = START + (START * 4) / 100;
        uint256 expectedMin = START + (START * 5) / 100;
        vm.prank(bidder2);
        vm.expectRevert(abi.encodeWithSelector(TerritoryAuction.BidTooLow.selector, expectedMin, tooLow));
        auction.bid(auctionId, tooLow);

        uint256 minNext = START + (START * 5) / 100;
        vm.prank(bidder2);
        auction.bid(auctionId, minNext);

        (,, , uint256 highBid, address highBidder,,) = auction.auctions(auctionId);
        assertEq(highBid, minNext);
        assertEq(highBidder, bidder2);
    }

    function testAuctionExtensionOnLastMinuteBid() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime - 5 minutes);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        (,,,,, uint256 newEndTime,) = auction.auctions(auctionId);
        assertEq(newEndTime, block.timestamp + 10 minutes);
    }

    function testFinalizeAuctionWithWinner() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        uint256 sellerUsdcBefore   = usdc.balanceOf(seller);
        uint256 treasuryUsdcBefore = usdc.balanceOf(treasury);

        auction.finalizeAuction(auctionId);

        assertEq(nft.ownerOf(tokenId), bidder1);

        uint256 royalty = START * 500 / 10_000;
        assertEq(usdc.balanceOf(treasury), treasuryUsdcBefore + royalty);
        assertEq(usdc.balanceOf(seller), sellerUsdcBefore + START - royalty);
    }

    function testFinalizeAuctionNoBids() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        auction.finalizeAuction(auctionId);

        assertEq(nft.ownerOf(tokenId), seller);
    }

    function testWithdrawPendingReturn() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        uint256 minNext = START + (START * 5) / 100;
        vm.prank(bidder2);
        auction.bid(auctionId, minNext);

        assertEq(auction.pendingReturns(bidder1, auctionId), START);

        uint256 beforeBal = usdc.balanceOf(bidder1);
        vm.prank(bidder1);
        auction.withdrawPendingReturn(auctionId);

        assertEq(usdc.balanceOf(bidder1), beforeBal + START);
        assertEq(auction.pendingReturns(bidder1, auctionId), 0);
    }

    function testCancelAuctionNoBids() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(seller);
        auction.cancelAuction(auctionId);

        assertEq(nft.ownerOf(tokenId), seller);
    }

    function testCancelAuctionWithBidsReverts() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(TerritoryAuction.BidsAlreadyPlaced.selector, auctionId));
        auction.cancelAuction(auctionId);
    }

    // ─── New Tests ─────────────────────────────────────────────────────────────

    function test_finalizeAuction_royaltyCappedAt15Percent() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(bidder1);
        auction.bid(auctionId, START);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        uint256 maliciousRoyalty = START / 2; // 50%
        vm.mockCall(
            address(nft),
            abi.encodeWithSelector(bytes4(keccak256("royaltyInfo(uint256,uint256)")), tokenId, START),
            abi.encode(treasury, maliciousRoyalty)
        );

        uint256 treasuryUsdcBefore = usdc.balanceOf(treasury);
        uint256 sellerUsdcBefore   = usdc.balanceOf(seller);

        auction.finalizeAuction(auctionId);

        uint256 expectedCap = START * 1500 / 10_000;
        uint256 expectedSeller = START - expectedCap;

        assertEq(usdc.balanceOf(treasury), treasuryUsdcBefore + expectedCap);
        assertEq(usdc.balanceOf(seller), sellerUsdcBefore + expectedSeller);
    }

    function test_finalizeAuction_recipientContractWithoutReceiver_reverts() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        NoReceiverContract noReceiver = new NoReceiverContract();

        usdc.mint(address(noReceiver), 100_000_000);
        vm.prank(address(noReceiver));
        usdc.approve(address(auction), type(uint256).max);

        vm.prank(address(noReceiver));
        auction.bid(auctionId, START);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InvalidReceiver.selector,
                address(noReceiver)
            )
        );
        auction.finalizeAuction(auctionId);
    }

    function test_cancelAuction_succeeds() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        vm.prank(seller);
        auction.cancelAuction(auctionId);
        assertEq(nft.ownerOf(tokenId), seller);
    }

    function test_finalizeAuction_noBids_returnsToSeller_succeeds() public {
        uint256 tokenId   = _mintMythic(seller);
        uint256 auctionId = _createAuction(tokenId);

        (,,,,, uint256 endTime,) = auction.auctions(auctionId);
        vm.warp(endTime + 1);

        auction.finalizeAuction(auctionId);
        assertEq(nft.ownerOf(tokenId), seller);
    }
}
