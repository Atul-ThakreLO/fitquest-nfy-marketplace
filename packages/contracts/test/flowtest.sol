// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// fix imports yourself
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {TerritoryMarketplace} from "../src/TerritoryMarketplace.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

import "forge-std/Test.sol";

contract FullFlowTest is Test {
    TerritoryNFT nft;
    TerritoryMarketplace marketplace;


    MockUSDC usdc;

    address admin = address(100);
    address minter = address(200);
    address treasury = address(300);

    address seller = address(1);
    address buyer  = address(2);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy NFT
        nft = new TerritoryNFT(admin, minter, treasury);

        vm.stopPrank();

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy marketplace
        marketplace = new TerritoryMarketplace(
            address(nft),
            address(usdc),
            treasury
        );
    }

    function test_fullFlow() public {
        uint256 tokenId;

        // ─────────────────────────────
        // 1. Mint NFT
        // ─────────────────────────────
        vm.startPrank(minter);

        nft.safeMint(seller, TerritoryNFT.Rarity.MYTHIC, "cid");

        vm.stopPrank();

        tokenId = 1;

        // ─────────────────────────────
        // 2. Mark firstListed (CRITICAL)
        // ─────────────────────────────
        vm.prank(minter);
        nft.markFirstListed(tokenId);

        // ─────────────────────────────
        // 3. Seller approves marketplace
        // ─────────────────────────────
        vm.prank(seller);
        nft.approve(address(marketplace), tokenId);

        // ─────────────────────────────
        // 4. Seller creates listing
        // ─────────────────────────────
        vm.prank(seller);
        marketplace.createListing(tokenId, 100e6); // 100 USDC

        // ─────────────────────────────
        // 5. Fund buyer
        // ─────────────────────────────
        usdc.mint(buyer, 100e6);

        // ─────────────────────────────
        // 6. Buyer approves USDC
        // ─────────────────────────────
        vm.prank(buyer);
        usdc.approve(address(marketplace), 100e6);

        // ─────────────────────────────
        // 7. Buyer buys NFT
        // ─────────────────────────────
        vm.prank(buyer);
        marketplace.buyListing(tokenId);

        // Verify ownership
        assertEq(nft.ownerOf(tokenId), buyer);

        // ─────────────────────────────
        // 8. Buyer approves again
        // ─────────────────────────────
        vm.prank(buyer);
        nft.approve(address(marketplace), tokenId);

        // ─────────────────────────────
        // 9. Buyer re-lists
        // ─────────────────────────────
        vm.prank(buyer);
        marketplace.createListing(tokenId, 150e6);

        // Verify listing
        TerritoryMarketplace.Listing memory listing = marketplace.getListing(tokenId);

        assertEq(listing.seller, buyer);
        assertEq(listing.price, 150e6);
        assertTrue(listing.active);
    }
}