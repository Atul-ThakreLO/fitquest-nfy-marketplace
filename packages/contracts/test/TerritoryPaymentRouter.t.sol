// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/TerritoryAuction.sol";
import "../src/TerritoryPaymentRouter.sol";
import "../src/MockUSDC.sol";

contract MockWETH {
    function deposit() external payable {}
    function withdraw(uint256 wad) external {
        payable(msg.sender).transfer(wad);
    }
}

contract MockSwapRouter is ISwapRouter02 {
    MockUSDC public usdc;
    constructor(MockUSDC _usdc) { usdc = _usdc; }
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {
        require(msg.value == params.amountInMaximum, "Mock: incorrect ETH forwarded");
        usdc.mint(params.recipient, params.amountOut);
        amountIn = params.amountInMaximum / 2;
    }
    function refundETH() external payable {
        payable(msg.sender).transfer(address(this).balance / 2);
    }
    receive() external payable {}
}

contract TerritoryPaymentRouterTest is Test {
    TerritoryNFT            internal nft;
    TerritoryMarketplace    internal market;
    TerritoryAuction        internal auction;
    TerritoryPaymentRouter  internal router;
    MockUSDC                internal usdc;
    MockWETH                internal weth;
    MockSwapRouter          internal swapRouter;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal seller   = makeAddr("seller");
    address internal buyer    = makeAddr("buyer");

    uint256 internal constant PRICE = 10_000_000;

    function setUp() public {
        usdc = new MockUSDC();
        weth = new MockWETH();
        swapRouter = new MockSwapRouter(usdc);
        nft = new TerritoryNFT(admin, minter, treasury);
        market = new TerritoryMarketplace(address(nft), address(usdc), treasury);
        auction = new TerritoryAuction(address(nft), address(usdc), treasury);

        router = new TerritoryPaymentRouter(
            address(weth), address(usdc), address(swapRouter), address(market), address(auction)
        );
    }

    function testRouterBuyListing() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "CID");
        vm.prank(minter);
        nft.markFirstListed(1);

        vm.prank(seller);
        nft.approve(address(market), 1);
        vm.prank(seller);
        market.createListing(1, PRICE);

        vm.deal(buyer, 1 ether);
        uint256 beforeBal = buyer.balance;
        vm.prank(buyer);
        router.buyListingWithETH{value: 1 ether}(1, block.timestamp + 300);

        assertEq(nft.ownerOf(1), buyer);
        assertFalse(market.getListing(1).active);
        
        assertTrue(buyer.balance < beforeBal);
        assertTrue(buyer.balance > beforeBal - 1 ether); 
    }

    function testRouterBidAuction() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "CID");
        vm.prank(minter);
        nft.markFirstListed(1);

        vm.prank(seller);
        nft.approve(address(auction), 1);
        vm.prank(seller);
        auction.createAuction(1, PRICE, 1 days);

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        router.bidWithETH{value: 1 ether}(1, PRICE, block.timestamp + 300);

        (,,,, address highestBidder,,) = auction.auctions(1);
        assertEq(highestBidder, buyer); 
    }

    // ─── New Tests ─────────────────────────────────────────────────────────────

    function test_buyListingWithETH_expiredDeadline_reverts() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "CID");
        vm.prank(minter);
        nft.markFirstListed(1);

        vm.prank(seller);
        nft.approve(address(market), 1);
        vm.prank(seller);
        market.createListing(1, PRICE);

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(TerritoryPaymentRouter.TransactionExpired.selector);
        router.buyListingWithETH{value: 1 ether}(1, block.timestamp - 1);
    }

    function test_bidWithETH_expiredDeadline_reverts() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "CID");
        vm.prank(minter);
        nft.markFirstListed(1);

        vm.prank(seller);
        nft.approve(address(auction), 1);
        vm.prank(seller);
        auction.createAuction(1, PRICE, 1 days);

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(TerritoryPaymentRouter.TransactionExpired.selector);
        router.bidWithETH{value: 1 ether}(1, PRICE, block.timestamp - 1);
    }

    function test_buyListingWithETH_validDeadline_succeeds() public {
        vm.prank(minter);
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "CID");
        vm.prank(minter);
        nft.markFirstListed(1);

        vm.prank(seller);
        nft.approve(address(market), 1);
        vm.prank(seller);
        market.createListing(1, PRICE);

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        router.buyListingWithETH{value: 1 ether}(1, block.timestamp + 300);

        assertEq(nft.ownerOf(1), buyer);
    }
}
