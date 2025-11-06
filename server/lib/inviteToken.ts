import crypto from 'crypto';

/**
 * Generate a secure random invitation token
 * @returns A secure random token (32 bytes hex = 64 characters)
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash an invitation token for secure storage
 * @param token The plain text token
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Verify a token against its hash
 * @param token The plain text token to verify
 * @param hash The stored hash to compare against
 * @returns True if the token matches the hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
}

/**
 * Calculate expiration time for an invitation token
 * @param hoursFromNow Number of hours until expiration (default 48)
 * @returns Date object representing the expiration time
 */
export function getTokenExpiration(hoursFromNow: number = 48): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + hoursFromNow);
  return expiration;
}

/**
 * Check if a token has expired
 * @param expiresAt The expiration timestamp
 * @returns True if the token has expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}
