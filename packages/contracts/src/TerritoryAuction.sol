// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @dev Minimal interface to read TerritoryNFT token metadata
interface ITerritoryNFTAuction {
    function tokenData(uint256 tokenId)
        external
        view
        returns (
            uint8   rarity,
            string memory ipfsCid,
            bool    firstListed
        );
}

/// @title TerritoryAuction
/// @author Atul Thakre
/// @notice English-style auction contract restricted to MYTHIC-tier Territory NFTs.
///         All bids are denominated in USDC (6 decimals).
///         Bidders must approve USDC to this contract before calling bid().
///         Includes 5% minimum bid increment and 10-minute anti-sniping extension.
///         Outbid amounts are tracked as pending USDC returns for safe withdrawal.
///         Royalties are capped at MAX_ROYALTY_BPS on finalization.
///         NFT transfers use safeTransferFrom (avoids locking tokens).
contract TerritoryAuction is ReentrancyGuard, IERC721Receiver {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroNFTAddress();
    error ZeroUSDCAddress();
    error ZeroRoyaltyReceiver();
    error NotOwner();
    error StartPriceMustBePositive();
    error InvalidDuration();
    error OnlyMythicTokens();
    error TokenNotYetFirstListed(uint256 tokenId);
    error AlreadyFinalized(uint256 auctionId);
    error AuctionEnded(uint256 auctionId);
    error AuctionNotFound(uint256 auctionId);
    error BidTooLow(uint256 minRequired, uint256 provided);
    error USDCTransferFromBidderFailed();
    error AuctionNotEnded(uint256 auctionId);
    error RoyaltyTransferFailed();
    error SellerTransferFailed();
    error NothingToWithdraw();
    error WithdrawFailed();
    error NotSeller();
    error BidsAlreadyPlaced(uint256 auctionId);
    error InvalidBidder();

    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    // MYTHIC = 4 (matches TerritoryNFT.Rarity enum)
    uint8   private constant RARITY_MYTHIC            = 4;
    uint8   public  constant MIN_BID_INCREMENT_PERCENT = 5;
    uint256 public  constant MIN_DURATION              = 1 hours;
    uint256 public  constant MAX_DURATION              = 7 days;
    uint256 public  constant ANTI_SNIPE_WINDOW         = 10 minutes;
    uint256 public  constant MAX_ROYALTY_BPS           = 1500; // 15% hard cap — matches Marketplace

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    IERC721 public immutable nftContract;
    IERC20  public immutable usdc;
    address public immutable royaltyReceiver;

    struct Auction {
        address seller;
        uint256 tokenId;
        uint256 startPrice;
        uint256 highestBid;
        address highestBidder;
        uint256 endTime;
        bool    finalized;
    }

    uint256 public auctionCounter;
    mapping(uint256 => Auction) public auctions;

    /// @notice Pending USDC returns for outbid participants, per auction
    mapping(address => mapping(uint256 => uint256)) public pendingReturns;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 startPrice,
        uint256 endTime
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 finalPrice);
    event AuctionCancelledNoBids(uint256 indexed auctionId);
    event AuctionCancelled(uint256 indexed auctionId);
    event PendingReturnWithdrawn(address indexed bidder, uint256 indexed auctionId, uint256 amount);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /// @param _nftContract     Address of the TerritoryNFT contract
    /// @param _usdc            Address of the USDC ERC-20 token (6 decimals)
    /// @param _royaltyReceiver Address that receives royalty share on finalization
    constructor(address _nftContract, address _usdc, address _royaltyReceiver) {
        if (_nftContract     == address(0)) revert ZeroNFTAddress();
        if (_usdc            == address(0)) revert ZeroUSDCAddress();
        if (_royaltyReceiver == address(0)) revert ZeroRoyaltyReceiver();
        nftContract     = IERC721(_nftContract);
        usdc            = IERC20(_usdc);
        royaltyReceiver = _royaltyReceiver;
    }

    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Core functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Create an auction for a MYTHIC NFT. NFT is escrowed in this contract.
    ///         Token must have firstListed == true. Duration: 1 hour – 7 days.
    function createAuction(
        uint256 tokenId,
        uint256 startPrice,
        uint256 durationSeconds
    ) external {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (startPrice == 0)                             revert StartPriceMustBePositive();
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION)
            revert InvalidDuration();

        // Verify MYTHIC rarity and firstListed
        (uint8 rarity, , bool firstListed) =
            ITerritoryNFTAuction(address(nftContract)).tokenData(tokenId);
        if (rarity != RARITY_MYTHIC) revert OnlyMythicTokens();
        if (!firstListed)            revert TokenNotYetFirstListed(tokenId);

        // Escrow NFT
        nftContract.safeTransferFrom(msg.sender, address(this), tokenId);

        auctionCounter++;
        uint256 auctionId = auctionCounter;
        uint256 endTime   = block.timestamp + durationSeconds;

        auctions[auctionId] = Auction({
            seller:        msg.sender,
            tokenId:       tokenId,
            startPrice:    startPrice,
            highestBid:    0,
            highestBidder: address(0),
            endTime:       endTime,
            finalized:     false
        });

        emit AuctionCreated(auctionId, tokenId, msg.sender, startPrice, endTime);
    }

    /// @notice Place a bid on an active auction.
    ///         Bidder must approve at least `amount` USDC to this contract first.
    ///         Must meet minimum bid (startPrice or 5% above current highest bid).
    ///         Extends auction by 10 minutes if bid arrives in last 10 minutes.
    ///         Previous highest bidder's USDC is tracked as a pending return.
    function bid(uint256 auctionId, uint256 amount) external nonReentrant {
        _bid(auctionId, amount, msg.sender, msg.sender);
    }

    /// @notice Place a bid on behalf of another user.
    ///         Pulls USDC from the caller but attributes the bid (and NFTs/Refunds) to the bidder.
    function bidFor(uint256 auctionId, uint256 amount, address bidder) external nonReentrant {
        if (bidder == address(0)) revert InvalidBidder();
        _bid(auctionId, amount, msg.sender, bidder);
    }

    function _bid(uint256 auctionId, uint256 amount, address payer, address bidder) internal {
        Auction storage auction = auctions[auctionId];
        if (auction.finalized)          revert AlreadyFinalized(auctionId);
        if (block.timestamp >= auction.endTime) revert AuctionEnded(auctionId);
        if (auction.seller == address(0))       revert AuctionNotFound(auctionId);

        // Minimum bid calculation
        uint256 minBid;
        if (auction.highestBidder == address(0)) {
            minBid = auction.startPrice;
        } else {
            minBid = auction.highestBid +
                (auction.highestBid * MIN_BID_INCREMENT_PERCENT) / 100;
        }
        if (amount < minBid) revert BidTooLow(minBid, amount);

        // Move previous highest bidder's funds to pendingReturns
        if (auction.highestBidder != address(0)) {
            pendingReturns[auction.highestBidder][auctionId] += auction.highestBid;
        }

        // Pull USDC from payer (checks-effects-interactions: storage updated after)
        if (!usdc.transferFrom(payer, address(this), amount))
            revert USDCTransferFromBidderFailed();

        auction.highestBid    = amount;
        auction.highestBidder = bidder;

        // Anti-sniping: extend by 10 minutes if bid arrives in last 10 minutes
        if (auction.endTime - block.timestamp < ANTI_SNIPE_WINDOW) {
            auction.endTime = block.timestamp + ANTI_SNIPE_WINDOW;
        }

        emit BidPlaced(auctionId, bidder, amount);
    }

    /// @notice Finalize an auction after it ends.
    ///         If there's a winner: pays royalty in USDC (capped at 15%), pays seller in USDC, transfers NFT.
    ///         If no bids: returns NFT to seller.
    ///         Uses safeTransferFrom to avoid locking tokens.
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        if (auction.seller == address(0))       revert AuctionNotFound(auctionId);
        if (block.timestamp < auction.endTime)  revert AuctionNotEnded(auctionId);
        if (auction.finalized)                  revert AlreadyFinalized(auctionId);

        auction.finalized = true;

        if (auction.highestBidder != address(0)) {
            uint256 finalPrice = auction.highestBid;
            address winner     = auction.highestBidder;

            // Compute royalty via ERC-2981
            (address royaltyRecv, uint256 royaltyAmount) =
                IERC2981(address(nftContract)).royaltyInfo(auction.tokenId, finalPrice);

            // ── Royalty cap — prevents arithmetic underflow if royalty >= finalPrice ──
            uint256 maxRoyalty = (finalPrice * MAX_ROYALTY_BPS) / 10_000;
            if (royaltyAmount > maxRoyalty) {
                royaltyAmount = maxRoyalty;
            }

            // Pay royalty in USDC
            if (royaltyAmount > 0) {
                address recv = royaltyRecv != address(0) ? royaltyRecv : royaltyReceiver;
                if (!usdc.transfer(recv, royaltyAmount))
                    revert RoyaltyTransferFailed();
            }

            // Pay seller in USDC — safe: royaltyAmount <= maxRoyalty <= finalPrice
            uint256 sellerProceeds = finalPrice - royaltyAmount;
            if (!usdc.transfer(auction.seller, sellerProceeds))
                revert SellerTransferFailed();

            // Transfer NFT to winner
            nftContract.safeTransferFrom(address(this), winner, auction.tokenId);

            emit AuctionFinalized(auctionId, winner, finalPrice);
        } else {
            // No bids — return NFT to seller
            nftContract.safeTransferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionCancelledNoBids(auctionId);
        }
    }

    /// @notice Withdraw pending USDC return from an outbid position.
    ///         Uses checks-effects-interactions pattern to prevent reentrancy.
    function withdrawPendingReturn(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingReturns[msg.sender][auctionId];
        if (amount == 0) revert NothingToWithdraw();

        // Effects before interaction
        pendingReturns[msg.sender][auctionId] = 0;

        if (!usdc.transfer(msg.sender, amount))
            revert WithdrawFailed();

        emit PendingReturnWithdrawn(msg.sender, auctionId, amount);
    }

    /// @notice Cancel an auction that has NO bids. Only the seller can cancel.
    ///         Returns the escrowed NFT to the seller via safeTransferFrom.
    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        if (auction.seller != msg.sender)          revert NotSeller();
        if (auction.finalized)                     revert AlreadyFinalized(auctionId);
        if (auction.highestBidder != address(0))   revert BidsAlreadyPlaced(auctionId);

        auction.finalized = true;

        nftContract.safeTransferFrom(address(this), msg.sender, auction.tokenId);

        emit AuctionCancelled(auctionId);
    }
}