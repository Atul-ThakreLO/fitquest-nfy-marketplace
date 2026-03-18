// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TerritoryNFT.sol";

contract TerritoryNFTTest is Test {
    TerritoryNFT internal nft;

    address internal admin    = makeAddr("admin");
    address internal minter   = makeAddr("minter");
    address internal treasury = makeAddr("treasury");
    address internal user     = makeAddr("user");
    address internal attacker = makeAddr("attacker");

    uint256 internal _testNextTokenId = 1;

    function setUp() public {
        nft = new TerritoryNFT(admin, minter, treasury);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _mintToken(address to, TerritoryNFT.Rarity rarity)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(minter);
        nft.safeMint(to, rarity, "QmTestCID");
        tokenId = _testNextTokenId;
        _testNextTokenId++;
        return tokenId;
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    /// @dev Non-minter cannot call safeMint
    function testMintRequiresMinterRole() public {
        vm.prank(attacker);
        vm.expectRevert();
        nft.safeMint(user, TerritoryNFT.Rarity.COMMON, "QmTestCID");
    }

    /// @dev Minting stores correct tokenData and emits event
    function testMintSucceeds() public {
        vm.expectEmit(true, true, false, true);
        emit TerritoryNFT.TokenMinted(1, user, TerritoryNFT.Rarity.RARE);

        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.RARE);

        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), user);

        TerritoryNFT.TokenData memory data = nft.getTokenData(tokenId);
        assertEq(uint8(data.rarity), uint8(TerritoryNFT.Rarity.RARE));
        assertEq(data.ipfsCID, "QmTestCID");
        assertFalse(data.firstListed);
        assertEq(nft.tokenURI(tokenId), "ipfs://QmTestCID/metadata.json");
    }

    /// @dev Transfer is blocked when firstListed == false
    function testTransferBlockedBeforeFirstListed() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(user);
        vm.expectRevert("TerritoryNFT: not yet first-listed");
        nft.transferFrom(user, attacker, tokenId);
    }

    /// @dev Transfer succeeds after markFirstListed
    function testTransferAllowedAfterFirstListed() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(minter); // minter has LISTER_ROLE
        nft.markFirstListed(tokenId);

        vm.prank(user);
        nft.transferFrom(user, attacker, tokenId);
        assertEq(nft.ownerOf(tokenId), attacker);
    }

    /// @dev markFirstListed requires LISTER_ROLE
    function testMarkFirstListedRequiresListerRole() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(attacker);
        vm.expectRevert();
        nft.markFirstListed(tokenId);
    }

    /// @dev Royalty is 5% of sale price, receiver is orgTreasury
    function testRoyaltyInfo() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);
        uint256 salePrice = 1 ether;

        (address receiver, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, salePrice);
        assertEq(receiver, treasury);
        assertEq(royaltyAmount, salePrice * 500 / 10000); // 5%
    }

    /// @dev LISTER_ROLE holder can transfer even before firstListed (org initial transfer)
    function testListerRoleCanTransferBeforeFirstListed() public {
        // Mint to minter wallet (org initial)
        uint256 tokenId = _mintToken(minter, TerritoryNFT.Rarity.COMMON);
        assertFalse(nft.getTokenData(tokenId).firstListed);

        // Minter (LISTER_ROLE) transfers to marketplace — should succeed
        vm.prank(minter);
        nft.transferFrom(minter, user, tokenId);
        assertEq(nft.ownerOf(tokenId), user);
    }
}
