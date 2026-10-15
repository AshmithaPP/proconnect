import 'server-only';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { calculateSlidingExpiry, calculateAbsoluteExpiry } from '@/features/auth/session';

/**
 * Find a portal account (any role, active or inactive) by normalized email
 * @param {string} email
 * @returns {Promise<any | null>}
 */
export async function findPortalUserByEmail(email) {
  const rows = await query(
    `SELECT portal_user_id, full_name, email, password_hash, user_role, account_status, created_at, last_login_at
     FROM portal_users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update the last_login_at timestamp for an account
 * @param {string} portalUserId
 */
export async function updatePortalUserLastLogin(portalUserId) {
  await query(
    `UPDATE portal_users SET last_login_at = NOW() WHERE portal_user_id = ?`,
    [portalUserId]
  );
}

/**
 * List accounts with a given role (no password hashes)
 * @param {'platform_admin' | 'consultant'} userRole
 */
export async function listPortalUsersByRole(userRole) {
  const rows = await query(
    `SELECT portal_user_id, full_name, email, account_status, created_at, last_login_at
     FROM portal_users
     WHERE user_role = ?
     ORDER BY created_at ASC`,
    [userRole]
  );
  return rows.map((row) => ({
    portalUserId: row.portal_user_id,
    fullName: row.full_name,
    email: row.email,
    accountStatus: row.account_status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

/**
 * @param {string} portalUserId
 * @returns {Promise<any | null>} raw row incl. password_hash (server use only)
 */
export async function findPortalUserById(portalUserId) {
  const rows = await query(
    `SELECT portal_user_id, full_name, email, password_hash, user_role, account_status
     FROM portal_users WHERE portal_user_id = ? LIMIT 1`,
    [portalUserId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * @param {{ fullName: string, email: string, passwordHash: string, userRole: 'platform_admin'|'consultant' }} account
 * @returns {Promise<{ outcome: 'created', portalUserId: string } | { outcome: 'email_taken' }>}
 */
export async function createPortalUser({ fullName, email, passwordHash, userRole }) {
  const portalUserId = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [portalUserId, fullName, email, passwordHash, userRole]
    );
    return { outcome: 'created', portalUserId };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { outcome: 'email_taken' };
    throw err;
  }
}

/**
 * Update name / email / status of one account of a given role.
 * @param {string} portalUserId
 * @param {'platform_admin'|'consultant'} userRole - guards against editing another role's account
 * @param {{ fullName?: string, email?: string, accountStatus?: 'active'|'inactive' }} changes
 * @returns {Promise<'updated' | 'not_found' | 'email_taken'>}
 */
export async function updatePortalUser(portalUserId, userRole, changes) {
  const columns = { fullName: 'full_name', email: 'email', accountStatus: 'account_status' };
  const entries = Object.entries(changes).filter(([key, value]) => columns[key] && value !== undefined);
  if (!entries.length) return 'updated';

  try {
    const result = await query(
      `UPDATE portal_users SET ${entries.map(([key]) => `${columns[key]} = ?`).join(', ')}
       WHERE portal_user_id = ? AND user_role = ?`,
      [...entries.map(([, value]) => value), portalUserId, userRole]
    );
    return result.affectedRows ? 'updated' : 'not_found';
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return 'email_taken';
    throw err;
  }
}

/**
 * @param {string} portalUserId
 * @param {string} passwordHash
 */
export async function setPortalUserPassword(portalUserId, passwordHash) {
  await query(`UPDATE portal_users SET password_hash = ? WHERE portal_user_id = ?`, [passwordHash, portalUserId]);
}

/**
 * Sign an account out everywhere (after a password change, reset or deactivation),
 * optionally keeping the session that made the change.
 * @param {string} portalUserId
 * @param {string} [keepSessionTokenHash]
 */
export async function revokeAllSessionsForUser(portalUserId, keepSessionTokenHash) {
  await query(
    `UPDATE portal_sessions SET revoked_at = NOW()
     WHERE portal_user_id = ? AND revoked_at IS NULL AND session_token_hash <> ?`,
    [portalUserId, keepSessionTokenHash || '']
  );
}

/**
 * Store a new session record in MySQL with a dynamic UUID
 * @param {Object} params
 * @param {string} params.portalUserId
 * @param {string} params.sessionTokenHash
 * @returns {Promise<string>} sessionId
 */
export async function createPortalSession({ portalUserId, sessionTokenHash }) {
  const slidingExpiry = calculateSlidingExpiry();
  const absoluteExpiry = calculateAbsoluteExpiry();
  const sessionId = crypto.randomUUID();

  await query(
    `INSERT INTO portal_sessions (session_id, portal_user_id, session_token_hash, expires_at, absolute_expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, portalUserId, sessionTokenHash, slidingExpiry, absoluteExpiry]
  );
  return sessionId;
}

/**
 * Verify a session token hash for ONE role and fetch the account in a single query.
 * Rejects expired, revoked or inactive accounts, and sessions belonging to another role —
 * an admin session can never open the consultant portal, and vice versa.
 * @param {string} sessionTokenHash
 * @param {'platform_admin' | 'consultant'} userRole
 * @returns {Promise<{ session: any, user: any } | null>}
 */
export async function findValidSession(sessionTokenHash, userRole) {
  const rows = await query(
    `SELECT
       s.session_id,
       s.expires_at,
       s.absolute_expires_at,
       s.last_activity_at,
       u.portal_user_id,
       u.full_name,
       u.email,
       u.user_role,
       u.account_status,
       u.last_login_at
     FROM portal_sessions s
     JOIN portal_users u ON s.portal_user_id = u.portal_user_id
     WHERE s.session_token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND s.absolute_expires_at > NOW()
       AND u.account_status = 'active'
       AND u.user_role = ?
     LIMIT 1`,
    [sessionTokenHash, userRole]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    session: {
      sessionId: row.session_id,
      portalUserId: row.portal_user_id,
      expiresAt: row.expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
      lastActivityAt: row.last_activity_at,
    },
    user: {
      portalUserId: row.portal_user_id,
      fullName: row.full_name,
      email: row.email,
      userRole: row.user_role,
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
      `UPDATE portal_sessions
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
    `UPDATE portal_sessions SET revoked_at = NOW() WHERE session_token_hash = ?`,
    [sessionTokenHash]
  );
}

/**
 * Clean up expired and long-revoked sessions from MySQL
 */
export async function purgeExpiredSessions() {
  try {
    await query(
      `DELETE FROM portal_sessions
       WHERE expires_at < NOW()
          OR absolute_expires_at < NOW()
          OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))`
    );
  } catch (err) {
    console.error('Purge expired sessions error:', err.message);
  }
}
