// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/TerritoryAuction.sol";

/// @title Deploy
/// @notice Deploys all three Territory NFT contracts in sequence.
///         Reads ADMIN_ADDRESS, MINTER_ADDRESS, and ORG_TREASURY_ADDRESS from the environment.
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url base_sepolia \
///     --broadcast \
///     --verify \
///     -vvvv
contract Deploy is Script {
    function run() external {
        address admin    = vm.envAddress("ADMIN_ADDRESS");
        address minter   = vm.envAddress("MINTER_ADDRESS");
        address treasury = vm.envAddress("ORG_TREASURY_ADDRESS");

        vm.startBroadcast();

        // 1. NFT contract
        TerritoryNFT nft = new TerritoryNFT(admin, minter, treasury);

        // 2. Marketplace (takes NFT address + treasury as royalty receiver)
        TerritoryMarketplace market = new TerritoryMarketplace(address(nft), treasury);

        // 3. Auction (takes NFT address + treasury as royalty receiver)
        TerritoryAuction auctionContract = new TerritoryAuction(address(nft), treasury);

        vm.stopBroadcast();

        console.log("=======================================");
        console.log("TerritoryNFT:         ", address(nft));
        console.log("TerritoryMarketplace: ", address(market));
        console.log("TerritoryAuction:     ", address(auctionContract));
        console.log("=======================================");
        console.log("Next steps:");
        console.log("  1. Update .env with the above addresses");
        console.log("  2. Run: cd packages/shared && bun run sync-abis");
    }
}
