// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/// @dev Minimal interface to read TerritoryNFT token metadata
interface ITerritoryNFT {
    function tokenData(uint256 tokenId)
        external
        view
        returns (
            uint8   rarity,
            string memory ipfsCid,
            bool    firstListed
        );
}

/// @title TerritoryMarketplace
/// @author Atul Thakre
/// @notice Fixed-price marketplace for Territory NFTs.
///         Org can list freshly minted tokens (pre-firstListed). Users can list once firstListed.
///         Royalties are paid automatically to the royalty receiver on each sale.
contract TerritoryMarketplace is ReentrancyGuard {
    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    bytes32 private constant LISTER_ROLE = keccak256("LISTER_ROLE");

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    IERC721     public immutable nftContract;
    address     public immutable royaltyReceiver;

    struct Listing {
        address seller;
        uint256 price;   // in wei
        bool    active;
    }

    mapping(uint256 tokenId => Listing) public listings;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /// @param _nftContract   Address of the TerritoryNFT contract
    /// @param _royaltyReceiver Address that receives royalty share on each sale
    constructor(address _nftContract, address _royaltyReceiver) {
        require(_nftContract != address(0), "TerritoryMarketplace: zero nft");
        require(_royaltyReceiver != address(0), "TerritoryMarketplace: zero receiver");
        nftContract     = IERC721(_nftContract);
        royaltyReceiver = _royaltyReceiver;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Core functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Create a fixed-price listing for a token.
    ///         Caller must own the token and have approved this contract.
    ///         If caller has LISTER_ROLE on NFT contract, firstListed check is skipped.
    function createListing(uint256 tokenId, uint256 price) external {
        require(price > 0, "TerritoryMarketplace: price must be > 0");
        require(!listings[tokenId].active, "TerritoryMarketplace: already listed");

        address owner = nftContract.ownerOf(tokenId);
        bool isLister = IAccessControl(address(nftContract)).hasRole(LISTER_ROLE, msg.sender);

        require(
            msg.sender == owner || isLister,
            "TerritoryMarketplace: not owner or lister"
        );

        // Approval check
        require(
            nftContract.getApproved(tokenId) == address(this) ||
            nftContract.isApprovedForAll(owner, address(this)),
            "TerritoryMarketplace: not approved"
        );

        // firstListed check (org bypasses via LISTER_ROLE)
        if (!isLister) {
            (, , bool firstListed) = ITerritoryNFT(address(nftContract)).tokenData(tokenId);
            require(firstListed, "TerritoryMarketplace: token not yet first-listed");
        }

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Purchase a listed token. Sends ETH, receives NFT.
    ///         Automatically computes and forwards royalty. Refunds overpayment.
    function buyListing(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.active, "TerritoryMarketplace: not listed");
        require(msg.value >= listing.price, "TerritoryMarketplace: insufficient payment");
        require(msg.sender != listing.seller, "TerritoryMarketplace: seller cannot buy own listing");

        // Compute royalty via ERC-2981
        (address royaltyRecv, uint256 royaltyAmount) =
            IERC2981(address(nftContract)).royaltyInfo(tokenId, listing.price);

        // Delete listing before external calls (checks-effects-interactions)
        delete listings[tokenId];

        // Pay royalty
        if (royaltyAmount > 0) {
            address recv = royaltyRecv != address(0) ? royaltyRecv : royaltyReceiver;
            (bool royaltyOk,) = recv.call{value: royaltyAmount}("");
            require(royaltyOk, "TerritoryMarketplace: royalty transfer failed");
        }

        // Pay seller
        uint256 sellerProceeds = listing.price - royaltyAmount;
        (bool sellerOk,) = listing.seller.call{value: sellerProceeds}("");
        require(sellerOk, "TerritoryMarketplace: seller transfer failed");

        // Transfer NFT to buyer
        nftContract.safeTransferFrom(listing.seller, msg.sender, tokenId);

        // Refund overpayment
        uint256 overpay = msg.value - listing.price;
        if (overpay > 0) {
            (bool refundOk,) = msg.sender.call{value: overpay}("");
            require(refundOk, "TerritoryMarketplace: refund failed");
        }

        emit Sold(tokenId, listing.seller, msg.sender, listing.price);
    }

    /// @notice Cancel an active listing. Only the seller can cancel.
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].active, "TerritoryMarketplace: not listed");
        require(listings[tokenId].seller == msg.sender, "TerritoryMarketplace: not seller");
        delete listings[tokenId];
        emit ListingCancelled(tokenId);
    }

    /// @notice Update the price of an active listing. Only the seller can update.
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        require(listings[tokenId].active, "TerritoryMarketplace: not listed");
        require(listings[tokenId].seller == msg.sender, "TerritoryMarketplace: not seller");
        require(newPrice > 0, "TerritoryMarketplace: price must be > 0");
        listings[tokenId].price = newPrice;
        emit PriceUpdated(tokenId, newPrice);
    }

    /// @notice Returns the Listing struct for a given token
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
}
