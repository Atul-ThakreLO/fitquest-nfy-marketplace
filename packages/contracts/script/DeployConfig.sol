// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

/// @title DeployConfig
/// @notice Reads and validates deployment configuration from environment variables.
///         Import this in other scripts to avoid repeating env reads.
contract DeployConfig is Script {
    struct Config {
        address admin;
        address minter;
        address treasury;
        string  rpcUrl;
    }

    function load() internal view returns (Config memory cfg) {
        cfg.admin    = vm.envAddress("ADMIN_ADDRESS");
        cfg.minter   = vm.envAddress("MINTER_ADDRESS");
        cfg.treasury = vm.envAddress("ORG_TREASURY_ADDRESS");

        require(cfg.admin != address(0),    "DeployConfig: ADMIN_ADDRESS not set");
        require(cfg.minter != address(0),   "DeployConfig: MINTER_ADDRESS not set");
        require(cfg.treasury != address(0), "DeployConfig: ORG_TREASURY_ADDRESS not set");
    }
}
