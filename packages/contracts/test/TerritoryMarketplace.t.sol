// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/MockUSDC.sol";

/// @dev Minimal contract that does NOT implement IERC721Receiver.
///      Used to verify transferFrom succeeds where safeTransferFrom would revert.
contract NoReceiverContract {}

contract TerritoryMarketplaceTest is Test {
    TerritoryNFT        internal nft;
    TerritoryMarketplace internal market;
    MockUSDC             internal usdc;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal seller   = makeAddr("seller");
    address internal buyer    = makeAddr("buyer");

    uint256 internal _testNextTokenId = 1;
    // 10 USDC (6 decimals)
    uint256 internal constant PRICE = 10_000_000;

    function setUp() public {
        usdc   = new MockUSDC();
        nft    = new TerritoryNFT(admin, minter, treasury);
        market = new TerritoryMarketplace(address(nft), address(usdc), treasury);

        // Fund buyer with USDC
        usdc.mint(buyer, 1_000_000_000); // 1000 USDC
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /// Mint + markFirstListed + approve marketplace for NFT
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

    /// Approve USDC from buyer to marketplace
    function _approveUSDC(address from, uint256 amount) internal {
        vm.prank(from);
        usdc.approve(address(market), amount);
    }

    // ─── Existing tests (regression) ─────────────────────────────────────────

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
        vm.expectRevert(abi.encodeWithSelector(TerritoryMarketplace.TokenNotYetFirstListed.selector, tokenId));
        market.createListing(tokenId, PRICE);
    }

    /// @dev buyListing transfers NFT to buyer and USDC to seller (minus royalty)
    function testBuyListingTransfersNFTAndFunds() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 sellerUsdcBefore = usdc.balanceOf(seller);
        _approveUSDC(buyer, PRICE);

        vm.prank(buyer);
        market.buyListing(tokenId);

        // NFT transferred
        assertEq(nft.ownerOf(tokenId), buyer);

        // Listing deleted
        assertFalse(market.getListing(tokenId).active);

        // Seller received proceeds (price minus 5% royalty)
        uint256 royalty  = PRICE * 500 / 10000;
        uint256 proceeds = PRICE - royalty;
        assertEq(usdc.balanceOf(seller), sellerUsdcBefore + proceeds);
    }

    /// @dev Royalty is paid to treasury on each sale
    function testRoyaltyPaidOnSale() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        _approveUSDC(buyer, PRICE);

        vm.prank(buyer);
        market.buyListing(tokenId);

        uint256 royalty = PRICE * 500 / 10000;
        assertEq(usdc.balanceOf(treasury), treasuryBefore + royalty);
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

    /// @dev Buy reverts if buyer has insufficient USDC allowance
    function testBuyRevertsWithoutAllowance() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        // No approval from buyer
        vm.prank(buyer);
        vm.expectRevert();
        market.buyListing(tokenId);
    }

    /// @dev Seller cannot buy their own listing
    function testCannotBuyOwnListing() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        usdc.mint(seller, PRICE);
        _approveUSDC(seller, PRICE);

        vm.prank(seller);
        vm.expectRevert(TerritoryMarketplace.SellerCannotBuyOwnListing.selector);
        market.buyListing(tokenId);
    }

    /// @dev Price update is reflected in the listing
    function testUpdatePrice() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 newPrice = 20_000_000; // 20 USDC
        vm.prank(seller);
        market.updatePrice(tokenId, newPrice);

        assertEq(market.getListing(tokenId).price, newPrice);
    }

    // ─── New tests: royalty cap ───────────────────────────────────────────────

    /// @dev If royalty > 15%, it is capped — no arithmetic revert, seller gets ≥ 85%
    function test_buyListing_royaltyCappedAt15Percent() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        // Mock royaltyInfo to return 50% of price — would underflow without cap
        uint256 maliciousRoyalty = PRICE / 2; // 50%
        vm.mockCall(
            address(nft),
            abi.encodeWithSelector(bytes4(keccak256("royaltyInfo(uint256,uint256)")), tokenId, PRICE),
            abi.encode(treasury, maliciousRoyalty)
        );

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 sellerBefore   = usdc.balanceOf(seller);

        _approveUSDC(buyer, PRICE);
        vm.prank(buyer);
        market.buyListing(tokenId); // must NOT revert

        uint256 expectedCap  = PRICE * 1500 / 10_000; // 15%
        uint256 expectedSeller = PRICE - expectedCap;

        assertEq(usdc.balanceOf(treasury), treasuryBefore + expectedCap,  "royalty capped at 15%");
        assertEq(usdc.balanceOf(seller),   sellerBefore   + expectedSeller, "seller gets 85%");
        assertEq(nft.ownerOf(tokenId), buyer, "NFT transferred");
    }

    /// @dev Royalty exactly at 15% is accepted without capping
    function test_buyListing_royaltyExactly15Percent_doesNotRevert() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        uint256 exactCap = PRICE * 1500 / 10_000;
        vm.mockCall(
            address(nft),
            abi.encodeWithSelector(bytes4(keccak256("royaltyInfo(uint256,uint256)")), tokenId, PRICE),
            abi.encode(treasury, exactCap)
        );

        _approveUSDC(buyer, PRICE);
        vm.prank(buyer);
        market.buyListing(tokenId); // must NOT revert

        assertEq(usdc.balanceOf(treasury), exactCap);
    }

    /// @dev Royalty below 15% is paid in full (cap not applied)
    function test_buyListing_royaltyBelow15Percent_paidInFull() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        // 5% royalty (default)
        uint256 royalty = PRICE * 500 / 10_000;

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        _approveUSDC(buyer, PRICE);
        vm.prank(buyer);
        market.buyListing(tokenId);

        assertEq(usdc.balanceOf(treasury), treasuryBefore + royalty, "full 5% royalty paid");
    }

    // ─── New test: transferFrom works for plain contract recipients ───────────

    /// @dev Recipient that has no onERC721Received hook fails to receive the NFT
    ///      because we use safeTransferFrom instead of transferFrom.
    function test_buyListingFor_recipientIsContractWithoutERC721Receiver_reverts() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        NoReceiverContract noReceiver = new NoReceiverContract();

        usdc.mint(address(this), PRICE);
        usdc.approve(address(market), PRICE);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InvalidReceiver.selector,
                address(noReceiver)
            )
        );
        market.buyListingFor(tokenId, address(noReceiver)); // must revert
    }

    /// @dev buyListingFor reverts if the recipient address is zero
    function test_buyListingFor_zeroRecipient_reverts() public {
        uint256 tokenId = _mintReadyToken(seller);

        vm.prank(seller);
        market.createListing(tokenId, PRICE);

        vm.expectRevert(TerritoryMarketplace.InvalidRecipient.selector);
        market.buyListingFor(tokenId, address(0));
    }
}
