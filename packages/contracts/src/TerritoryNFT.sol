// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

/// @title TerritoryNFT
/// @author Atul Thakre
/// @notice ERC721 NFT contract where each token represents a unique geographic territory tile.
///         Only org backend (MINTER_ROLE) can mint. Transfers are locked until org performs
///         the first listing (firstListed flag). MYTHIC-tier NFTs can be auctioned.
contract TerritoryNFT is ERC721URIStorage, AccessControl, ERC2981 {
    // ────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ────────────────────────────────────────────────────────────────────────

    error ZeroAdmin();
    error ZeroMinter();
    error ZeroTreasury();
    error EmptyCID();
    error TokenDoesNotExist(uint256 tokenId);
    error AlreadyFirstListed(uint256 tokenId);
    error NotYetFirstListed(uint256 tokenId);

    // ────────────────────────────────────────────────────────────────────────
    // Roles
    // ────────────────────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant LISTER_ROLE  = keccak256("LISTER_ROLE");

    // ────────────────────────────────────────────────────────────────────────
    // Types
    // ────────────────────────────────────────────────────────────────────────

    enum Rarity { COMMON, RARE, EPIC, LEGENDARY, MYTHIC }

    struct TokenData {
        Rarity  rarity;
        string  ipfsCID;
        bool    firstListed;
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Auto-incrementing token ID counter (starts at 1)
    uint256 private _nextTokenId;

    /// @notice Full metadata for each minted token
    mapping(uint256 tokenId => TokenData) public tokenData;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event TokenMinted(uint256 indexed tokenId, address indexed to, Rarity rarity);
    event FirstListingMarked(uint256 indexed tokenId);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /// @param admin      Address granted DEFAULT_ADMIN_ROLE (org Gnosis Safe multisig)
    /// @param minter     Address granted MINTER_ROLE and LISTER_ROLE (org hot wallet)
    /// @param orgTreasury Royalty receiver address (org Gnosis Safe)
    constructor(address admin, address minter, address orgTreasury)
        ERC721("TerritoryNFT", "TNFT")
    {
        if (admin      == address(0)) revert ZeroAdmin();
        if (minter     == address(0)) revert ZeroMinter();
        if (orgTreasury == address(0)) revert ZeroTreasury();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(LISTER_ROLE, minter);

        // 5% royalty — 500 basis points
        _setDefaultRoyalty(orgTreasury, 500);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Minting
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Mint a new territory NFT. Only callable by MINTER_ROLE.
    /// @param to       Recipient (usually org wallet initially)
    /// @param rarity   Rarity tier of this tile
    /// @param ipfsCID  IPFS CID for the metadata folder (tokenURI → ipfs://{cid}/metadata.json)
    function safeMint(
        address to,
        Rarity rarity,
        string calldata ipfsCID
    ) external onlyRole(MINTER_ROLE) {
        if (bytes(ipfsCID).length == 0) revert EmptyCID();

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        // Store on-chain metadata
        tokenData[tokenId] = TokenData({
            rarity: rarity,
            ipfsCID: ipfsCID,
            firstListed: false
        });

        // Mint and set URI
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, string.concat("ipfs://", ipfsCID, "/metadata.json"));

        emit TokenMinted(tokenId, to, rarity);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Listing control
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Mark a token as firstListed, enabling free trading.
    ///         Only callable by LISTER_ROLE (org backend hot wallet).
    function markFirstListed(uint256 tokenId) external onlyRole(LISTER_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        if (tokenData[tokenId].firstListed)  revert AlreadyFirstListed(tokenId);
        tokenData[tokenId].firstListed = true;
        emit FirstListingMarked(tokenId);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View helpers
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Returns the full TokenData struct for a given token
    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return tokenData[tokenId];
    }

    /// @notice Returns true only if the token's firstListed flag is set
    function isTransferable(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return tokenData[tokenId].firstListed;
    }

    /// @notice Returns LISTER_ROLE status and tokenData in a single call.
    ///         Used by Marketplace to reduce external call count (avoids two separate interface casts).
    /// @param role    Role to check (typically LISTER_ROLE)
    /// @param account Address to check role for
    /// @param tokenId NFT token ID to read metadata for
    function hasRoleAndTokenData(bytes32 role, address account, uint256 tokenId)
        external
        view
        returns (bool roleGranted, uint8 rarity, string memory ipfsCid, bool firstListed)
    {
        roleGranted = hasRole(role, account);
        TokenData memory td = tokenData[tokenId];
        rarity      = uint8(td.rarity);
        ipfsCid     = td.ipfsCID;
        firstListed = td.firstListed;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Transfer guard (OZ 5.x hook)
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Blocks transfers until firstListed is true.
    ///         Exceptions: minting (from == address(0)) and LISTER_ROLE transfers.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0))
        if (from != address(0)) {
            // Allow LISTER_ROLE holder to transfer (org initial transfer to marketplace)
            if (!hasRole(LISTER_ROLE, from)) {
                if (!tokenData[tokenId].firstListed)
                    revert NotYetFirstListed(tokenId);
            }
        }

        return super._update(to, tokenId, auth);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Required overrides
    // ────────────────────────────────────────────────────────────────────────

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
