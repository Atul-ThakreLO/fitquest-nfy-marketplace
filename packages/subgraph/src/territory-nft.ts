import { BigInt } from "@graphprotocol/graph-ts";
import {
  TokenMinted as TokenMintedEvent,
  Transfer as TransferEvent,
  FirstListingMarked as FirstListingMarkedEvent,
} from "../generated/TerritoryNFT/TerritoryNFT";
import { Token } from "../generated/schema";
import { loadOrCreateUser } from "./helpers";

/**
 * Handle TokenMinted event — creates the Token entity.
 *
 * Note: We handle Transfer separately to keep token ownership up to date.
 * TokenMinted fires before Transfer during mint, so we create the entity
 * here with initial data and let handleTransfer set the owner.
 */
export function handleTokenMinted(event: TokenMintedEvent): void {
  let tokenId = event.params.tokenId;

  // Load or init (Transfer may have already created it)
  let token = Token.load(tokenId.toString());
  if (token == null) {
    token = new Token(tokenId.toString());
  }

  // Create the recipient User entity
  let owner = loadOrCreateUser(event.params.to.toHexString());

  token.owner = owner.id;
  token.rarity = event.params.rarity;
  // ipfsCID is not emitted — will remain empty string until TokenMinted
  // is extended. We store what we have; the API resolves it from the chain.
  token.ipfsCID = "";
  token.firstListed = false;
  token.mintedAt = event.block.timestamp;
  token.mintTxHash = event.transaction.hash;

  token.save();
}

/**
 * Handle ERC-721 Transfer event — keeps Token.owner up to date.
 *
 * During minting, `from` is address(0). Subsequent transfers reflect
 * marketplace or auction-driven ownership changes.
 */
export function handleTransfer(event: TransferEvent): void {
  let tokenId = event.params.tokenId;
  let toAddress = event.params.to.toHexString();

  // Ensure recipient User entity exists
  loadOrCreateUser(toAddress);

  let token = Token.load(tokenId.toString());
  if (token == null) {
    // Token doesn't exist yet (Transfer fires before or without TokenMinted)
    token = new Token(tokenId.toString());
    token.rarity = 0;
    token.ipfsCID = "";
    token.firstListed = false;
    token.mintedAt = event.block.timestamp;
    token.mintTxHash = event.transaction.hash;
  }

  token.owner = toAddress;
  token.save();
}

/**
 * Handle FirstListingMarked event — sets firstListed flag on the Token.
 */
export function handleFirstListingMarked(event: FirstListingMarkedEvent): void {
  let tokenId = event.params.tokenId;
  let token = Token.load(tokenId.toString());
  if (token == null) return;

  token.firstListed = true;
  token.save();
}
