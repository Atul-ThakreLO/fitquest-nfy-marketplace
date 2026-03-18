import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Token, User } from "../generated/schema";

/**
 * Load an existing User entity or create a new one.
 * @param address - wallet address as lowercase hex string
 */
export function loadOrCreateUser(address: string): User {
  let user = User.load(address);
  if (user == null) {
    user = new User(address);
    user.save();
  }
  return user as User;
}

/**
 * Load an existing Token entity. Returns null if not found.
 */
export function loadToken(tokenId: BigInt): Token | null {
  return Token.load(tokenId.toString());
}
