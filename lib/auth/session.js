import crypto from 'crypto';

const SLIDING_EXPIRY_DAYS = Number(process.env.SESSION_SLIDING_EXPIRY_DAYS) || 7;
const ABSOLUTE_EXPIRY_DAYS = Number(process.env.SESSION_ABSOLUTE_EXPIRY_DAYS) || 30;

/**
 * Generate a 32-byte cryptographically random token string (256 bits of entropy)
 * @returns {string}
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a session token using SHA-256 for secure database storage
 * @param {string} rawToken 
 * @returns {string}
 */
export function hashSessionToken(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken) {
    throw new Error('Invalid raw token provided for hashing');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Calculate sliding expiration date from now
 * @returns {Date}
 */
export function calculateSlidingExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + SLIDING_EXPIRY_DAYS);
  return date;
}

/**
 * Calculate absolute hard-cap expiration date from creation time
 * @returns {Date}
 */
export function calculateAbsoluteExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + ABSOLUTE_EXPIRY_DAYS);
  return date;
}
