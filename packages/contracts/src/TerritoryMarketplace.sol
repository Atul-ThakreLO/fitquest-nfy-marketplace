// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/// @dev Combined interface — single external cast reads both role and token metadata.
///      Eliminates the double cold SLOAD of a separate IAccessControl + ITerritoryNFT call.
interface ITerritoryNFTFull {
    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);

    function tokenData(
        uint256 tokenId
    )
        external
        view
        returns (uint8 rarity, string memory ipfsCid, bool firstListed);

    function hasRoleAndTokenData(
        bytes32 role,
        address account,
        uint256 tokenId
    )
        external
        view
        returns (
            bool roleGranted,
            uint8 rarity,
            string memory ipfsCid,
            bool firstListed
        );
}

/// @title TerritoryMarketplace
/// @author Atul Thakre
/// @notice Fixed-price marketplace for Territory NFTs.
///         All prices are denominated in USDC (6 decimals).
///         Buyers must approve USDC to this contract before calling buyListing.
///         Org can list freshly minted tokens (pre-firstListed). Users can list once firstListed.
///         Royalties are automatically paid (capped at MAX_ROYALTY_BPS) on each sale.
contract TerritoryMarketplace is ReentrancyGuard {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroNFTAddress();
    error ZeroUSDCAddress();
    error ZeroRoyaltyReceiver();
    error PriceMustBePositive();
    error AlreadyListed(uint256 tokenId);
    error NotOwner();
    error NotApproved();
    error TokenNotYetFirstListed(uint256 tokenId);
    error NotListed(uint256 tokenId);
    error SellerCannotBuyOwnListing();
    error USDCTransferFromBuyerFailed();
    error RoyaltyTransferFailed();
    error SellerTransferFailed();
    error NotSeller();
    error NewPriceMustBePositive();
    error InvalidRecipient();

    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    bytes32 private constant LISTER_ROLE = keccak256("LISTER_ROLE");
    uint256 public constant MAX_ROYALTY_BPS = 1500; // 15% hard cap

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    IERC721 public immutable nftContract;
    IERC20 public immutable usdc;
    address public immutable royaltyReceiver;

    struct Listing {
        address seller;
        uint256 price; // in USDC micro-units (6 decimals)
        bool active;
    }

    mapping(uint256 tokenId => Listing) public listings;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event Listed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event Sold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    event ListingCancelled(uint256 indexed tokenId);
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /// @param _nftContract     Address of the TerritoryNFT contract
    /// @param _usdc            Address of the USDC ERC-20 token (6 decimals)
    /// @param _royaltyReceiver Address that receives royalty share on each sale
    constructor(address _nftContract, address _usdc, address _royaltyReceiver) {
        if (_nftContract == address(0)) revert ZeroNFTAddress();
        if (_usdc == address(0)) revert ZeroUSDCAddress();
        if (_royaltyReceiver == address(0)) revert ZeroRoyaltyReceiver();
        nftContract = IERC721(_nftContract);
        usdc = IERC20(_usdc);
        royaltyReceiver = _royaltyReceiver;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Core functions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Create a fixed-price listing for a token.
    ///         Caller must own the token and have approved this contract.
    ///         If caller has LISTER_ROLE on NFT contract, firstListed check is skipped.
    function createListing(uint256 tokenId, uint256 price) external {
        if (price == 0) revert PriceMustBePositive();
        if (listings[tokenId].active) revert AlreadyListed(tokenId);

        address owner = nftContract.ownerOf(tokenId);

        // Single interface cast — eliminates double cold SLOAD from two separate castings
        ITerritoryNFTFull nft = ITerritoryNFTFull(address(nftContract));

        if (msg.sender != owner) revert NotOwner();

        // Approval check
        if (
            nftContract.getApproved(tokenId) != address(this) &&
            !nftContract.isApprovedForAll(owner, address(this))
        ) revert NotApproved();

        // firstListed check (org bypasses via LISTER_ROLE)
        (, , bool firstListed) = nft.tokenData(tokenId);
        if (!firstListed) revert TokenNotYetFirstListed(tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(tokenId, msg.sender, price);
    }

    /// @notice Purchase a listed token by transferring USDC.
    ///         Buyer must have approved at least `listing.price` USDC to this contract.
    ///         Royalties are automatically split and forwarded (capped at 15%).
    function buyListing(uint256 tokenId) external nonReentrant {
        _buyListing(tokenId, msg.sender, msg.sender);
    }

    /// @notice Purchase a listing on behalf of another user. Pulls USDC from the caller, sends NFT to recipient.
    function buyListingFor(
        uint256 tokenId,
        address recipient
    ) external nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        _buyListing(tokenId, msg.sender, recipient);
    }

    function _buyListing(
        uint256 tokenId,
        address payer,
        address recipient
    ) internal {
        Listing memory listing = listings[tokenId];
        if (!listing.active) revert NotListed(tokenId);
        if (recipient == listing.seller) revert SellerCannotBuyOwnListing();

        // Compute royalty via ERC-2981
        (address royaltyRecv, uint256 royaltyAmount) = IERC2981(
            address(nftContract)
        ).royaltyInfo(tokenId, listing.price);

        // ── Royalty cap — prevents arithmetic underflow if royalty >= price ──
        uint256 maxRoyalty = (listing.price * MAX_ROYALTY_BPS) / 10_000;
        if (royaltyAmount > maxRoyalty) {
            royaltyAmount = maxRoyalty;
        }

        // Delete listing before external calls (checks-effects-interactions)
        delete listings[tokenId];

        // Pull USDC from payer
        if (!usdc.transferFrom(payer, address(this), listing.price))
            revert USDCTransferFromBuyerFailed();

        // Pay royalty
        if (royaltyAmount > 0) {
            address recv = royaltyRecv != address(0)
                ? royaltyRecv
                : royaltyReceiver;
            if (!usdc.transfer(recv, royaltyAmount))
                revert RoyaltyTransferFailed();
        }

        // Pay seller — safe: royaltyAmount <= maxRoyalty <= listing.price
        uint256 sellerProceeds = listing.price - royaltyAmount;
        if (!usdc.transfer(listing.seller, sellerProceeds))
            revert SellerTransferFailed();

        nftContract.safeTransferFrom(listing.seller, recipient, tokenId);

        emit Sold(tokenId, listing.seller, recipient, listing.price);
    }

    /// @notice Cancel an active listing. Only the seller can cancel.
    function cancelListing(uint256 tokenId) external {
        if (!listings[tokenId].active) revert NotListed(tokenId);
        if (listings[tokenId].seller != msg.sender) revert NotSeller();
        delete listings[tokenId];
        emit ListingCancelled(tokenId);
    }

    /// @notice Update the price of an active listing. Only the seller can update.
    function updatePrice(uint256 tokenId, uint256 newPrice) external {
        if (!listings[tokenId].active) revert NotListed(tokenId);
        if (listings[tokenId].seller != msg.sender) revert NotSeller();
        if (newPrice == 0) revert NewPriceMustBePositive();
        listings[tokenId].price = newPrice;
        emit PriceUpdated(tokenId, newPrice);
    }

    /// @notice Returns the Listing struct for a given token
    function getListing(
        uint256 tokenId
    ) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function canList(
        uint256 tokenId,
        address user
    ) external view returns (bool) {
        if (nftContract.ownerOf(tokenId) != user) return false;

        if (
            nftContract.getApproved(tokenId) != address(this) &&
            !nftContract.isApprovedForAll(user, address(this))
        ) return false;

        (, , bool firstListed) = ITerritoryNFTFull(address(nftContract))
            .tokenData(tokenId);

        return firstListed;
    }

    function canBuy(
        uint256 tokenId,
        address buyer
    ) external view returns (bool) {
        Listing memory listing = listings[tokenId];
        if (!listing.active) return false;
        if (buyer == listing.seller) return false;
        return true;
    }
}
