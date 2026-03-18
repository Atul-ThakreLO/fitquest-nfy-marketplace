// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
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
///         Includes 5% minimum bid increment and 10-minute anti-sniping extension.
///         Outbid amounts are tracked as pending returns for safe withdrawal.
contract TerritoryAuction is ReentrancyGuard {
    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    // MYTHIC = 4 (matches TerritoryNFT.Rarity enum)
    uint8   private constant RARITY_MYTHIC            = 4;
    uint8   public  constant MIN_BID_INCREMENT_PERCENT = 5;
    uint256 public  constant MIN_DURATION              = 1 hours;
    uint256 public  constant MAX_DURATION              = 7 days;
    uint256 public  constant ANTI_SNIPE_WINDOW         = 10 minutes;

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    IERC721 public immutable nftContract;
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

    /// @notice Pending ETH returns for outbid participants, per auction
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

    /// @param _nftContract   Address of the TerritoryNFT contract
    /// @param _royaltyReceiver Address that receives royalty share on finalization
    constructor(address _nftContract, address _royaltyReceiver) {
        require(_nftContract != address(0), "TerritoryAuction: zero nft");
        require(_royaltyReceiver != address(0), "TerritoryAuction: zero receiver");
        nftContract     = IERC721(_nftContract);
        royaltyReceiver = _royaltyReceiver;
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
        require(nftContract.ownerOf(tokenId) == msg.sender, "TerritoryAuction: not owner");
        require(startPrice > 0, "TerritoryAuction: start price must be > 0");
        require(
            durationSeconds >= MIN_DURATION && durationSeconds <= MAX_DURATION,
            "TerritoryAuction: invalid duration"
        );

        // Verify MYTHIC rarity and firstListed
        (uint8 rarity, , bool firstListed) =
            ITerritoryNFTAuction(address(nftContract)).tokenData(tokenId);
        require(rarity == RARITY_MYTHIC, "TerritoryAuction: only MYTHIC tokens");
        require(firstListed, "TerritoryAuction: token not yet first-listed");

        // Escrow NFT
        nftContract.transferFrom(msg.sender, address(this), tokenId);

        auctionCounter++;
        uint256 auctionId = auctionCounter;
        uint256 endTime = block.timestamp + durationSeconds;

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
    ///         Must meet minimum bid (startPrice or 5% above current highest bid).
    ///         Extends auction by 10 minutes if bid arrives in last 10 minutes.
    function bid(uint256 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.finalized, "TerritoryAuction: already finalized");
        require(block.timestamp < auction.endTime, "TerritoryAuction: auction ended");
        require(auction.seller != address(0), "TerritoryAuction: auction not found");

        // Minimum bid calculation
        uint256 minBid;
        if (auction.highestBidder == address(0)) {
            minBid = auction.startPrice;
        } else {
            minBid = auction.highestBid +
                (auction.highestBid * MIN_BID_INCREMENT_PERCENT) / 100;
        }
        require(msg.value >= minBid, "TerritoryAuction: bid too low");

        // Move previous highest bidder's funds to pendingReturns
        if (auction.highestBidder != address(0)) {
            pendingReturns[auction.highestBidder][auctionId] += auction.highestBid;
        }

        auction.highestBid    = msg.value;
        auction.highestBidder = msg.sender;

        // Anti-sniping: extend by 10 minutes if bid arrives in last 10 minutes
        if (auction.endTime - block.timestamp < ANTI_SNIPE_WINDOW) {
            auction.endTime = block.timestamp + ANTI_SNIPE_WINDOW;
        }

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    /// @notice Finalize an auction after it ends.
    ///         If there's a winner: pays royalty, pays seller, transfers NFT.
    ///         If no bids: returns NFT to seller.
    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "TerritoryAuction: auction not found");
        require(block.timestamp >= auction.endTime, "TerritoryAuction: auction not ended");
        require(!auction.finalized, "TerritoryAuction: already finalized");

        auction.finalized = true;

        if (auction.highestBidder != address(0)) {
            uint256 finalPrice = auction.highestBid;
            address winner     = auction.highestBidder;

            // Compute royalty via ERC-2981
            (address royaltyRecv, uint256 royaltyAmount) =
                IERC2981(address(nftContract)).royaltyInfo(auction.tokenId, finalPrice);

            // Pay royalty
            if (royaltyAmount > 0) {
                address recv = royaltyRecv != address(0) ? royaltyRecv : royaltyReceiver;
                (bool royaltyOk,) = recv.call{value: royaltyAmount}("");
                require(royaltyOk, "TerritoryAuction: royalty transfer failed");
            }

            // Pay seller
            uint256 sellerProceeds = finalPrice - royaltyAmount;
            (bool sellerOk,) = auction.seller.call{value: sellerProceeds}("");
            require(sellerOk, "TerritoryAuction: seller transfer failed");

            // Transfer NFT to winner
            nftContract.safeTransferFrom(address(this), winner, auction.tokenId);

            emit AuctionFinalized(auctionId, winner, finalPrice);
        } else {
            // No bids — return NFT to seller
            nftContract.safeTransferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionCancelledNoBids(auctionId);
        }
    }

    /// @notice Withdraw pending ETH return from an outbid position.
    ///         Uses checks-effects-interactions pattern to prevent reentrancy.
    function withdrawPendingReturn(uint256 auctionId) external nonReentrant {
        uint256 amount = pendingReturns[msg.sender][auctionId];
        require(amount > 0, "TerritoryAuction: nothing to withdraw");

        // Effects before interaction
        pendingReturns[msg.sender][auctionId] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "TerritoryAuction: withdraw failed");

        emit PendingReturnWithdrawn(msg.sender, auctionId, amount);
    }

    /// @notice Cancel an auction that has NO bids. Only the seller can cancel.
    ///         Returns the escrowed NFT to the seller.
    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.seller == msg.sender, "TerritoryAuction: not seller");
        require(!auction.finalized, "TerritoryAuction: already finalized");
        require(auction.highestBidder == address(0), "TerritoryAuction: bids already placed");

        auction.finalized = true;

        nftContract.safeTransferFrom(address(this), msg.sender, auction.tokenId);

        emit AuctionCancelled(auctionId);
    }
}
