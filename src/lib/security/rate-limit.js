import 'server-only';
import crypto from 'crypto';
import { query } from '@/lib/db';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const BLOCK_MINUTES = 15;

/**
 * Check if a client key is currently rate-limited in MySQL
 * @param {string} clientKey 
 * @param {string} action 
 * @returns {Promise<{ allowed: boolean, remainingAttempts: number, retryAfterSeconds?: number }>}
 */
export async function checkRateLimit(clientKey, action = 'login') {
  try {
    const rows = await query(
      `SELECT attempt_count, first_attempt_at, blocked_until,
              TIMESTAMPDIFF(SECOND, NOW(), blocked_until) AS seconds_remaining
       FROM rate_limits
       WHERE client_key = ? AND action = ?`,
      [clientKey, action]
    );

    if (rows.length === 0) {
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const record = rows[0];

    // If currently blocked
    if (record.blocked_until && record.seconds_remaining > 0) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, record.seconds_remaining),
      };
    }

    // Check if the window has expired since first attempt
    const windowExpiredRows = await query(
      `SELECT TIMESTAMPDIFF(MINUTE, first_attempt_at, NOW()) AS minutes_elapsed
       FROM rate_limits
       WHERE client_key = ? AND action = ?`,
      [clientKey, action]
    );

    if (windowExpiredRows.length > 0 && windowExpiredRows[0].minutes_elapsed >= WINDOW_MINUTES) {
      // Window expired, reset counter
      await query(
        `UPDATE rate_limits
         SET attempt_count = 0, first_attempt_at = NOW(), blocked_until = NULL
         WHERE client_key = ? AND action = ?`,
        [clientKey, action]
      );
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - record.attempt_count);
    return {
      allowed: record.attempt_count < MAX_ATTEMPTS,
      remainingAttempts: remaining,
    };
  } catch (err) {
    // If rate limit table is temporarily unreachable, fail safe to prevent total outage
    console.error('Rate limit check error:', err.message);
    return { allowed: true, remainingAttempts: 1 };
  }
}

/**
 * Record a failed attempt, escalating to lockout if threshold is exceeded
 * @param {string} clientKey 
 * @param {string} action 
 * @returns {Promise<{ blocked: boolean, retryAfterSeconds?: number }>}
 */
export async function recordFailedAttempt(clientKey, action = 'login') {
  try {
    const rateLimitId = crypto.randomUUID();
    await query(
      `INSERT INTO rate_limits (rate_limit_id, client_key, action, attempt_count, first_attempt_at, blocked_until)
       VALUES (?, ?, ?, 1, NOW(), NULL)
       ON DUPLICATE KEY UPDATE
         attempt_count = attempt_count + 1,
         blocked_until = IF(attempt_count >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL)`,
      [rateLimitId, clientKey, action, MAX_ATTEMPTS, BLOCK_MINUTES]
    );

    const status = await checkRateLimit(clientKey, action);
    return {
      blocked: !status.allowed,
      retryAfterSeconds: status.retryAfterSeconds,
    };
  } catch (err) {
    console.error('Record failed attempt error:', err.message);
    return { blocked: false };
  }
}

/**
 * Reset rate limit counter upon successful authentication
 * @param {string} clientKey 
 * @param {string} action 
 */
export async function clearRateLimit(clientKey, action = 'login') {
  try {
    await query(
      `DELETE FROM rate_limits WHERE client_key = ? AND action = ?`,
      [clientKey, action]
    );
  } catch (err) {
    console.error('Clear rate limit error:', err.message);
  }
}
