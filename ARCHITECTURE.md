# Architecture

## Custom Errors Catalogue

### TerritoryMarketplace Custom Errors

| Error | Function | Condition |
|---|---|---|
| `ZeroNFTAddress()` | constructor | `_nftContract == address(0)` |
| `ZeroUSDCAddress()` | constructor | `_usdc == address(0)` |
| `ZeroRoyaltyReceiver()` | constructor | `_royaltyReceiver == address(0)` |
| `InvalidRecipient()` | `buyListingFor` | `recipient == address(0)` |
| `PriceMustBePositive()` | `createListing`, `updatePrice` | `price == 0` |
| `AlreadyListed` | `createListing` | token already has active listing |
| `NotOwnerOrLister` | `createListing` | caller is neither owner nor lister |
| `NotApproved` | `createListing` | marketplace not approved for token |
| `TokenNotYetFirstListed` | `createListing` | `firstListed == false` and caller is not lister |
| `NotListed` | `buyListing`, `buyListingFor`, `cancelListing`, `updatePrice` | no active listing |
| `SellerCannotBuyOwnListing` | `_buyListing` | recipient is the seller |
| `USDCTransferFromBuyerFailed` | `_buyListing` | USDC `transferFrom` returns false |
| `RoyaltyTransferFailed` | `_buyListing` | royalty USDC `transfer` returns false |
| `SellerTransferFailed` | `_buyListing` | seller USDC `transfer` returns false |
| `NotSeller` | `cancelListing`, `updatePrice` | caller is not the listing seller |
| `NewPriceMustBePositive` | `updatePrice` | `newPrice == 0` |
