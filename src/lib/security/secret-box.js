import 'server-only';
import crypto from 'crypto';

/**
 * Encrypts secrets stored in the database (e.g. the SMTP password) with AES-256-GCM.
 *
 * Key: SETTINGS_ENCRYPTION_KEY in .env.local — 32 random bytes as 64 hex characters
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * The key never touches the database, so a DB dump alone cannot reveal the secrets.
 * Changing the key makes previously stored secrets unreadable (they must be re-entered).
 *
 * Stored format: "v1:<iv b64>:<auth tag b64>:<ciphertext b64>"
 */
const VERSION = 'v1';

function getKey() {
  const hex = process.env.SETTINGS_ENCRYPTION_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes). See .env.example.');
  }
  return Buffer.from(hex, 'hex');
}

/** @param {string} plainText */
export function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * @param {string} stored - value produced by encryptSecret
 * @returns {string}
 */
export function decryptSecret(stored) {
  const [version, iv, tag, data] = String(stored || '').split(':');
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error('Unrecognised encrypted value');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
