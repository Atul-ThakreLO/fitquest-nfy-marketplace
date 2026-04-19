// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TerritoryNFT.sol";
import "../src/TerritoryMarketplace.sol";
import "../src/TerritoryAuction.sol";
import "../src/TerritoryPaymentRouter.sol";

/// @title Deploy
/// @notice Deploys all three Territory NFT contracts in sequence.
///         Reads ADMIN_ADDRESS, MINTER_ADDRESS, ORG_TREASURY_ADDRESS, and USDC_ADDRESS
///         from the environment.
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
        address usdc     = vm.envAddress("USDC_ADDRESS");
        address weth     = 0x4200000000000000000000000000000000000006;
        address swapRouter = vm.envAddress("UNISWAP_ROUTER_ADDRESS");

        vm.startBroadcast();

        // 1. NFT contract
        TerritoryNFT nft = new TerritoryNFT(admin, minter, treasury);

        // 2. Marketplace (NFT address + USDC address + treasury as royalty receiver)
        TerritoryMarketplace market = new TerritoryMarketplace(address(nft), usdc, treasury);

        // 3. Auction (NFT address + USDC address + treasury as royalty receiver)
        TerritoryAuction auctionContract = new TerritoryAuction(address(nft), usdc, treasury);

        // 4. Payment Router
        TerritoryPaymentRouter paymentRouter = new TerritoryPaymentRouter(
            weth,
            usdc,
            swapRouter,
            address(market),
            address(auctionContract)
        );

        bytes32 LISTER_ROLE = keccak256("LISTER_ROLE");
        nft.setApprovalForAll(address(market), true);
        nft.setApprovalForAll(address(auctionContract), true);
        nft.grantRole(LISTER_ROLE, address(auctionContract));
        nft.grantRole(LISTER_ROLE, address(market));

        vm.stopBroadcast();

        console.log("=======================================");
        console.log("TerritoryNFT:         ", address(nft));
        console.log("TerritoryMarketplace: ", address(market));
        console.log("TerritoryAuction:     ", address(auctionContract));
        console.log("TerritoryPaymentRouter: ", address(paymentRouter));
        console.log("USDC (payment token): ", usdc);
        console.log("=======================================");
        console.log("Next steps:");
        console.log("  1. Update .env with the above addresses");
        console.log("  2. Run: cd packages/shared && bun run sync-abis");
        console.log("  3. Update subgraph.yaml addresses and redeploy subgraph");
    }
}
