import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_CHARS = 10;

/**
 * Validate password length safely before bcrypt operations.
 * Bcrypt ignores bytes beyond 72 bytes; we strictly enforce this limit to prevent truncation attacks.
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePasswordSafety(password) {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }
  if (password.length < MIN_PASSWORD_CHARS) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_CHARS} characters long` };
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return { valid: false, error: `Password must not exceed ${MAX_PASSWORD_BYTES} bytes` };
  }
  return { valid: true };
}

/**
 * Hash a password using bcrypt
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const safety = validatePasswordSafety(password);
  if (!safety.valid) {
    throw new Error(safety.error);
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain password against bcrypt hash
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || typeof hash !== 'string') {
    return false;
  }
  // Enforce max bytes limit to avoid processing attack vectors
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
