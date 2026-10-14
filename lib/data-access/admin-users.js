import crypto from 'crypto';
import { query } from '@/lib/db';
import { calculateSlidingExpiry, calculateAbsoluteExpiry } from '@/lib/auth/session';

/**
 * Find active or inactive admin user by normalized email
 * @param {string} email 
 * @returns {Promise<any | null>}
 */
export async function findAdminByEmail(email) {
  const rows = await query(
    `SELECT admin_user_id, full_name, email, password_hash, account_status, created_at, last_login_at
     FROM admin_users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update the last_login_at timestamp for an admin
 * @param {number|string} adminUserId 
 */
export async function updateAdminLastLogin(adminUserId) {
  await query(
    `UPDATE admin_users SET last_login_at = NOW() WHERE admin_user_id = ?`,
    [adminUserId]
  );
}

/**
 * Store a new session record in MySQL with a dynamic UUID
 * @param {Object} params 
 * @param {string} params.adminUserId 
 * @param {string} params.sessionTokenHash 
 * @returns {Promise<string>} sessionId
 */
export async function createAdminSession({ adminUserId, sessionTokenHash }) {
  const slidingExpiry = calculateSlidingExpiry();
  const absoluteExpiry = calculateAbsoluteExpiry();
  const sessionId = crypto.randomUUID();

  await query(
    `INSERT INTO admin_sessions (session_id, admin_user_id, session_token_hash, expires_at, absolute_expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, adminUserId, sessionTokenHash, slidingExpiry, absoluteExpiry]
  );
  return sessionId;
}

/**
 * Verify session token hash and fetch administrator profile in a single query
 * Rejects expired, revoked, or inactive accounts.
 * @param {string} sessionTokenHash 
 * @returns {Promise<{ session: any, admin: any } | null>}
 */
export async function findValidSession(sessionTokenHash) {
  const rows = await query(
    `SELECT 
       s.session_id,
       s.admin_user_id,
       s.expires_at,
       s.absolute_expires_at,
       s.last_activity_at,
       s.revoked_at,
       u.admin_user_id,
       u.full_name,
       u.email,
       u.account_status,
       u.last_login_at
     FROM admin_sessions s
     JOIN admin_users u ON s.admin_user_id = u.admin_user_id
     WHERE s.session_token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND s.absolute_expires_at > NOW()
       AND u.account_status = 'active'
     LIMIT 1`,
    [sessionTokenHash]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    session: {
      sessionId: row.session_id,
      adminUserId: row.admin_user_id,
      expiresAt: row.expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
      lastActivityAt: row.last_activity_at,
    },
    admin: {
      adminUserId: row.admin_user_id,
      fullName: row.full_name,
      email: row.email,
      accountStatus: row.account_status,
      lastLoginAt: row.last_login_at,
    },
  };
}

/**
 * Extend sliding window expiration and record activity timestamp.
 * Keeps sliding expiration constrained by absolute_expires_at.
 * @param {string} sessionTokenHash 
 */
export async function touchSessionActivity(sessionTokenHash) {
  try {
    await query(
      `UPDATE admin_sessions
       SET last_activity_at = NOW(),
           expires_at = LEAST(DATE_ADD(NOW(), INTERVAL 7 DAY), absolute_expires_at)
       WHERE session_token_hash = ? AND revoked_at IS NULL`,
      [sessionTokenHash]
    );
  } catch (err) {
    console.error('Touch session activity error:', err.message);
  }
}

/**
 * Revoke an active session by setting revoked_at = NOW()
 * @param {string} sessionTokenHash 
 */
export async function revokeSession(sessionTokenHash) {
  await query(
    `UPDATE admin_sessions SET revoked_at = NOW() WHERE session_token_hash = ?`,
    [sessionTokenHash]
  );
}

/**
 * Clean up expired and long-revoked sessions from MySQL
 */
export async function purgeExpiredSessions() {
  try {
    await query(
      `DELETE FROM admin_sessions
       WHERE expires_at < NOW()
          OR absolute_expires_at < NOW()
          OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))`
    );
  } catch (err) {
    console.error('Purge expired sessions error:', err.message);
  }
}
