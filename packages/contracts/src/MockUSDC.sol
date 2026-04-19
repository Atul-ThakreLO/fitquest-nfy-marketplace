// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Minimal ERC-20 with 6 decimals used ONLY in local Foundry tests.
///         Anyone can call mint() to get test tokens.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDC") {}

    /// @notice DECIMALS match real USDC (6)
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Permissionless mint — only for tests
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
