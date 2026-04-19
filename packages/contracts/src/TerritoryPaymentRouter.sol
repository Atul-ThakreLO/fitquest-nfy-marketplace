// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISwapRouter02 {
    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256 amountIn);

    function refundETH() external payable;
}

interface ITerritoryMarketplace {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    // Read an existing listing
    function getListing(uint256 tokenId) external view returns (Listing memory);
    
    // Purchase a listing on behalf of another user
    function buyListingFor(uint256 tokenId, address recipient) external;
}

interface ITerritoryAuction {
    function bidFor(uint256 auctionId, uint256 amount, address bidder) external;
}

/// @title TerritoryPaymentRouter
/// @notice Helper router that allows users to pay with native ETH.
///         It swaps ETH to the exact USDC amount required via Uniswap v3,
///         buys the NFT or places the bid, and refunds unspent ETH.
///         Both public functions require a `deadline` UNIX timestamp to prevent
///         stale transactions lingering in the mempool.
contract TerritoryPaymentRouter is ReentrancyGuard {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error TransactionExpired();
    error ListingNotActive();
    error InvalidPrice();
    error InvalidAmount();
    error NoETHProvided();
    error ETHRefundFailed();

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    address public immutable weth;
    address public immutable usdc;
    ISwapRouter02 public immutable swapRouter;
    ITerritoryMarketplace public immutable marketplace;
    ITerritoryAuction public immutable auction;

    // Standard 0.3% pool fee for ETH/USDC
    uint24 public constant POOL_FEE = 3000;

    constructor(
        address _weth,
        address _usdc,
        address _swapRouter,
        address _marketplace,
        address _auction
    ) {
        if (_weth == address(0) || _usdc == address(0) || _swapRouter == address(0))
            revert ZeroAddress();
        weth = _weth;
        usdc = _usdc;
        swapRouter = ISwapRouter02(_swapRouter);
        marketplace = ITerritoryMarketplace(_marketplace);
        auction = ITerritoryAuction(_auction);

        // Infinite approve Marketplace and Auction to spend this router's USDC
        IERC20(usdc).approve(_marketplace, type(uint256).max);
        IERC20(usdc).approve(_auction, type(uint256).max);
    }

    /// @notice Buys a marketplace listing using ETH.
    ///         Requires msg.value to be the maximum ETH the user is willing to spend.
    ///         Any unused ETH is refunded.
    /// @param tokenId  The NFT token ID to purchase.
    /// @param deadline UNIX timestamp after which the transaction is considered expired.
    function buyListingWithETH(uint256 tokenId, uint256 deadline) external payable nonReentrant {
        if (block.timestamp > deadline) revert TransactionExpired();

        ITerritoryMarketplace.Listing memory listing = marketplace.getListing(tokenId);
        if (!listing.active)    revert ListingNotActive();
        if (listing.price == 0) revert InvalidPrice();

        // Swap exact amount of USDC needed
        uint256 amountIn = _swapExactOutput(listing.price, msg.value);

        // Buy the listing directly delivering NFT to msg.sender
        marketplace.buyListingFor(tokenId, msg.sender);

        // Refund unspent ETH
        _refundRemainingETH(amountIn);
    }

    /// @notice Places a bid on an auction using ETH.
    ///         Requires msg.value to be the maximum ETH the user is willing to spend.
    ///         Any unused ETH is refunded.
    /// @param auctionId  The auction ID to bid on.
    /// @param usdcAmount The exact USDC bid amount.
    /// @param deadline   UNIX timestamp after which the transaction is considered expired.
    function bidWithETH(uint256 auctionId, uint256 usdcAmount, uint256 deadline) external payable nonReentrant {
        if (block.timestamp > deadline) revert TransactionExpired();
        if (usdcAmount == 0)            revert InvalidAmount();

        // Swap exact amount of USDC needed
        uint256 amountIn = _swapExactOutput(usdcAmount, msg.value);

        // Place the bid attributing it to msg.sender
        auction.bidFor(auctionId, usdcAmount, msg.sender);

        // Refund unspent ETH
        _refundRemainingETH(amountIn);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal Helpers
    // ────────────────────────────────────────────────────────────────────────

    function _swapExactOutput(uint256 usdcAmountOut, uint256 ethAmountInMax) internal returns (uint256 amountIn) {
        if (ethAmountInMax == 0) revert NoETHProvided();

        ISwapRouter02.ExactOutputSingleParams memory params = ISwapRouter02.ExactOutputSingleParams({
            tokenIn: weth,
            tokenOut: usdc,
            fee: POOL_FEE,
            recipient: address(this), // Router receives the USDC
            amountOut: usdcAmountOut,
            amountInMaximum: ethAmountInMax,
            sqrtPriceLimitX96: 0
        });

        // The exactOutputSingle function requires ETH to be sent with the call because weth is tokenIn.
        // SwapRouter02 wraps the ETH sent into WETH automatically if we pass ETH.
        amountIn = swapRouter.exactOutputSingle{value: ethAmountInMax}(params);

        // Uniswap Router holds the unspent ETH, we must call refundETH to pull it back to us.
        swapRouter.refundETH();
    }

    function _refundRemainingETH(uint256 amountIn) internal {
        uint256 remaining = msg.value - amountIn;
        if (remaining > 0) {
            (bool success, ) = msg.sender.call{value: remaining}("");
            if (!success) revert ETHRefundFailed();
        }
    }

    // Needed to receive ETH refunds from SwapRouter02
    receive() external payable {}
}
