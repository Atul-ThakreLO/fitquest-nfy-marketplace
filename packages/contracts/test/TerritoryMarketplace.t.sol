// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";

contract TerritoryMarketplaceTest is Test {
    TerritoryNFT        internal nft;
    TerritoryMarketplace internal market;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal seller   = makeAddr("seller");
    address internal buyer    = makeAddr("buyer");

    uint256 internal _testNextTokenId = 1;
    uint256 internal constant PRICE   = 1 ether;

    function setUp() public {
        nft    = new TerritoryNFT(admin, minter, treasury);
        market = new TerritoryMarketplace(address(nft), treasury);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// Mint + markFirstListed + approve marketplace
    function _mintReadyToken(address to) internal returns (uint256 tokenId) {
        vm.prank(minter);
        nft.safeMint(to, TerritoryNFT.Rarity.COMMON, "QmCID");
        tokenId = _testNextTokenId;
        _testNextTokenId++;

        vm.prank(minter);
        nft.markFirstListed(tokenId);

        vm.prank(to);
        nft.approve(address(market), tokenId);
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    /// @dev Owner can create a listing after firstListed
    function testCreateListingByOwner() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        TerritoryMarketplace.Listing memory l = market.getListing(tokenId);
        assertTrue(l.active);
        assertEq(l.seller, seller);
        assertEq(l.price, PRICE);
    }

    /// @dev Creating a listing fails if firstListed == false (non-lister)
    function testCreateListingRequiresFirstListed() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "QmCID");
        uint256 tokenId = _testNextTokenId;
        _testNextTokenId++;

        vm.prank(seller);
        nft.approve(address(market), tokenId);

        vm.prank(seller);
        vm.expectRevert("TerritoryMarketplace: token not yet first-listed");
        market.createListing(tokenId, PRICE);
    }

    /// @dev buyListing transfers NFT to buyer and funds to seller (minus royalty)
    function testBuyListingTransfersNFTAndFunds() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 sellerBalBefore = seller.balance;
        vm.deal(buyer, 2 ether);

        vm.prank(buyer);
        market.buyListing{value: PRICE}(tokenId);

        // NFT transferred
        assertEq(nft.ownerOf(tokenId), buyer);

        // Listing deleted
        assertFalse(market.getListing(tokenId).active);

        // Seller received proceeds (price minus 5% royalty)
        uint256 royalty   = PRICE * 500 / 10000;
        uint256 proceeds  = PRICE - royalty;
        assertEq(seller.balance, sellerBalBefore + proceeds);
    }

    /// @dev Royalty is paid to treasury on each sale
    function testRoyaltyPaidOnSale() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 treasuryBefore = treasury.balance;
        vm.deal(buyer, 2 ether);

        vm.prank(buyer);
        market.buyListing{value: PRICE}(tokenId);

        uint256 royalty = PRICE * 500 / 10000;
        assertEq(treasury.balance, treasuryBefore + royalty);
    }

    /// @dev Seller can cancel a listing
    function testCancelListing() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        vm.prank(seller);
        market.cancelListing(tokenId);

        assertFalse(market.getListing(tokenId).active);
    }

    /// @dev Buyer overpayment is refunded
    function testBuyRefundsOverpayment() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        vm.deal(buyer, 5 ether);
        uint256 buyerBefore = buyer.balance;

        vm.prank(buyer);
        market.buyListing{value: 3 ether}(tokenId);

        // Should only spend PRICE (1 ether), get 2 ether back
        assertEq(buyer.balance, buyerBefore - PRICE);
    }

    /// @dev Seller cannot buy their own listing
    function testCannotBuyOwnListing() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        vm.deal(seller, 5 ether);
        vm.prank(seller);
        vm.expectRevert("TerritoryMarketplace: seller cannot buy own listing");
        market.buyListing{value: PRICE}(tokenId);
    }
}
