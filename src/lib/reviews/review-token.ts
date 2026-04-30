import crypto from "crypto";

/**
 * Generates a secure token for review requests.
 * Returns the raw token (used in URLs) and its SHA-256 hash (stored in DB).
 */
export function generateReviewToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = hashReviewToken(raw);
  return { raw, hash };
}

/**
 * Hashes a raw token using SHA-256.
 */
export function hashReviewToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Looks up the tokenHash from a URL token.
 * The raw token is hashed; the hash is stored in DB.
 */
export function tokenToHash(urlToken: string): string {
  return hashReviewToken(urlToken);
}
