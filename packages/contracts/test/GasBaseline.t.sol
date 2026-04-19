// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/TerritoryAuction.sol";
import "../src/TerritoryPaymentRouter.sol";
import "../src/MockUSDC.sol";

contract CheapMockWETH is IERC20 {
    function totalSupply() external view returns (uint256) {}
    function balanceOf(address account) external view returns (uint256) {}
    function transfer(address to, uint256 value) external returns (bool) {}
    function allowance(address owner, address spender) external view returns (uint256) {}
    function approve(address spender, uint256 value) external returns (bool) {}
    function transferFrom(address from, address to, uint256 value) external returns (bool) {}
}

contract CheapMockSwapRouter is ISwapRouter02 {
    MockUSDC public usdc;
    constructor(MockUSDC _usdc) { usdc = _usdc; }
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn) {
        usdc.mint(params.recipient, params.amountOut);
        amountIn = params.amountInMaximum;
    }
    function refundETH() external payable {}
    receive() external payable {}
}

contract GasBaseline is Test {

    // ── Shared state ──────────────────────────────────────────────────────
    TerritoryNFT            internal nft;
    TerritoryMarketplace    internal marketplace;
    TerritoryAuction        internal auction;
    TerritoryPaymentRouter  internal router;
    MockUSDC                internal usdc;
    CheapMockWETH           internal weth;
    CheapMockSwapRouter     internal swapRouter;

    address internal seller  = makeAddr("seller");
    address internal buyer   = makeAddr("buyer");
    address internal bidder2 = makeAddr("bidder2");

    uint256 internal listedTokenId;
    uint256 internal auctionId;

    // ── Setup — all contract deploy + state setup here, NOT in tests ──────
    function setUp() public {
        usdc        = new MockUSDC();
        weth        = new CheapMockWETH();
        swapRouter  = new CheapMockSwapRouter(usdc);
        nft         = new TerritoryNFT(address(this), address(this), address(this));
        marketplace = new TerritoryMarketplace(address(nft), address(usdc), address(this));
        auction     = new TerritoryAuction(address(nft), address(usdc), address(this));
        router      = new TerritoryPaymentRouter(address(weth), address(usdc), address(swapRouter), address(marketplace), address(auction));

        // Grant roles
        bytes32 listerRole = nft.LISTER_ROLE();
        vm.startPrank(address(this));
        nft.grantRole(listerRole, address(marketplace));
        nft.grantRole(listerRole, address(auction));
        vm.stopPrank();

        // ── Prepare a ready-to-list token ─────────────────────────────────
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "QmTest1");
        listedTokenId = 1;
        nft.markFirstListed(listedTokenId);
        vm.stopPrank();

        vm.startPrank(seller);
        nft.approve(address(marketplace), listedTokenId);
        marketplace.createListing(listedTokenId, 100e6);
        vm.stopPrank();

        // ── Prepare a ready-to-finalize auction (with winner) ─────────────
        uint256 mythicTokenId;
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "QmMythic1");
        mythicTokenId = 2;
        nft.markFirstListed(mythicTokenId);
        vm.stopPrank();

        vm.startPrank(seller);
        nft.approve(address(auction), mythicTokenId);
        auction.createAuction(mythicTokenId, 100e6, 1 hours);
        auctionId = 1;
        vm.stopPrank();

        // Place a bid so finalize has a winner path to execute
        usdc.mint(buyer, 200e6);
        vm.startPrank(buyer);
        usdc.approve(address(auction), 200e6);
        auction.bid(auctionId, 100e6);
        vm.stopPrank();

        // Place a second bid so buyer has a pending return to withdraw
        usdc.mint(bidder2, 200e6);
        vm.startPrank(bidder2);
        usdc.approve(address(auction), 200e6);
        auction.bid(auctionId, 106e6); // 6% above 100e6
        vm.stopPrank();

        // Wind clock forward so auction is ended
        vm.warp(block.timestamp + 1 hours + 1);
    }

    // ── Gas tests — only the target call is inside gasleft() window ───────

    function test_gas_createListing() public {
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.COMMON, "QmGasTest");
        uint256 newTokenId = 3; 
        nft.markFirstListed(newTokenId);
        vm.stopPrank();
        vm.startPrank(seller);
        nft.approve(address(marketplace), newTokenId);
        vm.stopPrank();

        vm.prank(seller);
        uint256 gasBefore = gasleft();
        marketplace.createListing(newTokenId, 50e6);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("createListing gas", gasUsed);
        assertLt(gasUsed, 97_000, "createListing gas regression");
    }

    function test_gas_buyListing() public {
        usdc.mint(buyer, 200e6);
        vm.prank(buyer);
        usdc.approve(address(marketplace), 200e6);

        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        marketplace.buyListing(listedTokenId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("buyListing gas", gasUsed);
        assertLt(gasUsed, 197_000, "buyListing gas regression");
    }

    function test_gas_buyListingWithETH() public {
        vm.deal(buyer, 1 ether);
        
        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        router.buyListingWithETH{value: 1 ether}(listedTokenId, block.timestamp + 300);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("buyListingWithETH gas", gasUsed);
        assertLt(gasUsed, 276_000, "buyListingWithETH gas regression");
    }

    function test_gas_createAuction() public {
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "QmGasAuction");
        uint256 newTokenId = 3; 
        nft.markFirstListed(newTokenId);
        vm.stopPrank();
        vm.startPrank(seller);
        nft.approve(address(auction), newTokenId);
        vm.stopPrank();

        vm.prank(seller);
        uint256 gasBefore = gasleft();
        auction.createAuction(newTokenId, 100e6, 1 hours);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("createAuction gas", gasUsed);
        assertLt(gasUsed, 151_000, "createAuction gas regression");
    }

    function test_gas_bid() public {
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "QmGasBid");
        uint256 freshToken = 3;
        nft.markFirstListed(freshToken);
        vm.stopPrank();
        vm.startPrank(seller);
        nft.approve(address(auction), freshToken);
        auction.createAuction(freshToken, 100e6, 1 hours);
        uint256 freshAuctionId = 2;
        vm.stopPrank();

        usdc.mint(buyer, 200e6);
        vm.startPrank(buyer);
        usdc.approve(address(auction), 200e6);
        vm.stopPrank();

        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        auction.bid(freshAuctionId, 100e6);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("bid gas", gasUsed);
        assertLt(gasUsed, 71_000, "bid gas regression");
    }

    function test_gas_bidWithETH() public {
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "QmGasBid");
        uint256 freshToken = 3;
        nft.markFirstListed(freshToken);
        vm.stopPrank();
        vm.startPrank(seller);
        nft.approve(address(auction), freshToken);
        auction.createAuction(freshToken, 100e6, 1 hours);
        uint256 freshAuctionId = 2;
        vm.stopPrank();
        
        vm.deal(buyer, 1 ether);
        
        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        router.bidWithETH{value: 1 ether}(freshAuctionId, 100e6, block.timestamp + 300);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("bidWithETH gas", gasUsed);
        assertLt(gasUsed, 149_000, "bidWithETH gas regression");
    }

    function test_gas_finalizeAuction() public {
        uint256 gasBefore = gasleft();
        auction.finalizeAuction(auctionId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("finalizeAuction gas", gasUsed);
        assertLt(gasUsed, 188_000, "finalizeAuction gas regression");
    }

    function test_gas_cancelAuction() public {
        vm.startPrank(address(this));
        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "QmGasCancel");
        uint256 freshToken = 3;
        nft.markFirstListed(freshToken);
        vm.stopPrank();
        vm.startPrank(seller);
        nft.approve(address(auction), freshToken);
        auction.createAuction(freshToken, 100e6, 1 hours);
        uint256 freshAuctionId = 2;
        vm.stopPrank();

        vm.prank(seller);
        uint256 gasBefore = gasleft();
        auction.cancelAuction(freshAuctionId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("cancelAuction gas", gasUsed);
        assertLt(gasUsed, 40_000, "cancelAuction gas regression");
    }

    function test_gas_withdrawPendingReturn() public {
        auction.finalizeAuction(auctionId);

        vm.prank(buyer);
        uint256 gasBefore = gasleft();
        auction.withdrawPendingReturn(auctionId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("withdrawPendingReturn gas", gasUsed);
        assertLt(gasUsed, 24_000, "withdrawPendingReturn gas regression");
    }
}
