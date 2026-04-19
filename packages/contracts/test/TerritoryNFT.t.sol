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

    function _mintToken(address to, TerritoryNFT.Rarity rarity)
        internal
        returns (uint256 tokenId)
    {
        vm.prank(minter);
        nft.safeMint(to, rarity, "QmTestCID");
        tokenId = _testNextTokenId++;
        return tokenId;
    }

    function testMintRequiresMinterRole() public {
        vm.prank(attacker);
        vm.expectRevert();
        nft.safeMint(user, TerritoryNFT.Rarity.COMMON, "QmTestCID");
    }

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

    function testTransferBlockedBeforeFirstListed() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TerritoryNFT.NotYetFirstListed.selector, tokenId));
        nft.transferFrom(user, attacker, tokenId);
    }

    function testTransferAllowedAfterFirstListed() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(minter);
        nft.markFirstListed(tokenId);

        vm.prank(user);
        nft.transferFrom(user, attacker, tokenId);
        assertEq(nft.ownerOf(tokenId), attacker);
    }

    function testMarkFirstListedRequiresListerRole() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);

        vm.prank(attacker);
        vm.expectRevert();
        nft.markFirstListed(tokenId);
    }

    function testRoyaltyInfo() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.COMMON);
        uint256 salePrice = 1 ether;

        (address receiver, uint256 royaltyAmount) = nft.royaltyInfo(tokenId, salePrice);
        assertEq(receiver, treasury);
        assertEq(royaltyAmount, salePrice * 500 / 10000); 
    }

    function testListerRoleCanTransferBeforeFirstListed() public {
        uint256 tokenId = _mintToken(minter, TerritoryNFT.Rarity.COMMON);
        assertFalse(nft.getTokenData(tokenId).firstListed);

        vm.prank(minter);
        nft.transferFrom(minter, user, tokenId);
        assertEq(nft.ownerOf(tokenId), user);
    }

    // ─── New Tests ─────────────────────────────────────────────────────────────

    function test_hasRoleAndTokenData_returnsCorrectValues() public {
        uint256 tokenId = _mintToken(user, TerritoryNFT.Rarity.LEGENDARY);
        
        bytes32 role = nft.LISTER_ROLE();
        vm.prank(admin);
        nft.grantRole(role, user);

        (bool roleGranted, uint8 rarity, string memory ipfsCid, bool firstListed) = 
            nft.hasRoleAndTokenData(role, user, tokenId);

        assertTrue(roleGranted);
        assertEq(rarity, uint8(TerritoryNFT.Rarity.LEGENDARY));
        assertEq(ipfsCid, "QmTestCID");
        assertFalse(firstListed);
    }

    function test_hasRoleAndTokenData_tokenNotMinted_returnsDefault() public {
        (bool roleGranted, uint8 rarity, string memory ipfsCid, bool firstListed) = 
            nft.hasRoleAndTokenData(nft.LISTER_ROLE(), user, 999);

        assertFalse(roleGranted);
        assertEq(rarity, 0);
        assertEq(ipfsCid, "");
        assertFalse(firstListed);
    }
}
