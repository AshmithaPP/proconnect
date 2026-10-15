import 'server-only';
import crypto from 'crypto';
import { query } from '@/lib/db';

const ACCESS_TOKEN_DAYS = 60;

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

/**
 * Lock a booking's slot row inside a transaction.
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function lockBookingSlot(conn, bookingId) {
  const [rows] = await conn.execute(
    `SELECT booking_id, booking_status,
            DATE_FORMAT(consultation_date, '%Y-%m-%d') AS consultation_date,
            TIME_FORMAT(slot_start_time, '%H:%i') AS slot_start_time,
            TIME_FORMAT(slot_end_time, '%H:%i') AS slot_end_time
     FROM consultation_bookings WHERE booking_id = ? FOR UPDATE`,
    [bookingId]
  );
  return rows[0] || null;
}

/**
 * Move a booking to a new slot and record it. Throws ER_DUP_ENTRY (uq_confirmed_slot) if the
 * target slot was confirmed for someone else in the meantime — the caller tries the next one.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {{ bookingId: string, previous: { date: string, startTime: string, endTime: string },
 *   next: { date: string, startTime: string, endTime: string, label: string },
 *   reason: 'slot_taken'|'consultant_unavailable'|'customer_request', rescheduledBy: 'system'|'consultant'|'customer',
 *   rescheduledByUserId?: string|null }} move
 */
export async function moveBookingSlot(conn, { bookingId, previous, next, reason, rescheduledBy, rescheduledByUserId = null }) {
  await conn.execute(
    `UPDATE consultation_bookings
     SET consultation_date = ?, slot_start_time = ?, slot_end_time = ?, preferred_time_slot = ?,
         booking_status = 'confirmed', reschedule_count = reschedule_count + 1, pending_reschedule_reason = NULL
     WHERE booking_id = ?`,
    [next.date, next.startTime, next.endTime, next.label, bookingId]
  );
  await conn.execute(
    `INSERT INTO booking_reschedules
       (booking_reschedule_id, booking_id, previous_date, previous_start_time, previous_end_time,
        new_date, new_start_time, new_end_time, reschedule_reason, rescheduled_by, rescheduled_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(), bookingId, previous.date, previous.startTime, previous.endTime,
      next.date, next.startTime, next.endTime, reason, rescheduledBy, rescheduledByUserId,
    ]
  );
}

/**
 * No free slot: the booking waits (status reschedule_required) and is retried automatically.
 * @param {import('mysql2/promise').PoolConnection} conn
 */
export async function markBookingPendingReschedule(conn, bookingId, reason) {
  await conn.execute(
    `UPDATE consultation_bookings SET booking_status = 'reschedule_required', pending_reschedule_reason = ? WHERE booking_id = ?`,
    [reason, bookingId]
  );
}

/** Paid bookings waiting for a new slot, oldest payment first */
export async function listPendingRescheduleBookings() {
  const rows = await query(
    `SELECT b.booking_id, b.pending_reschedule_reason
     FROM consultation_bookings b
     WHERE b.booking_status = 'reschedule_required'
       AND EXISTS (SELECT 1 FROM booking_payments p WHERE p.booking_id = b.booking_id AND p.payment_status = 'paid')
     ORDER BY b.updated_at ASC`
  );
  return rows.map((row) => ({ bookingId: row.booking_id, reason: row.pending_reschedule_reason || 'slot_taken' }));
}

const RESCHEDULE_COLUMNS = `booking_id, reschedule_reason, rescheduled_by, created_at,
  DATE_FORMAT(previous_date, '%Y-%m-%d') AS previous_date,
  TIME_FORMAT(previous_start_time, '%H:%i') AS previous_start_time,
  TIME_FORMAT(previous_end_time, '%H:%i') AS previous_end_time,
  DATE_FORMAT(new_date, '%Y-%m-%d') AS new_date,
  TIME_FORMAT(new_start_time, '%H:%i') AS new_start_time,
  TIME_FORMAT(new_end_time, '%H:%i') AS new_end_time`;

const mapReschedule = (row) => ({
  bookingId: row.booking_id,
  reason: row.reschedule_reason,
  rescheduledBy: row.rescheduled_by,
  createdAt: row.created_at,
  previous: { date: row.previous_date, startTime: row.previous_start_time, endTime: row.previous_end_time },
  next: { date: row.new_date, startTime: row.new_start_time, endTime: row.new_end_time },
});

/** Full history of one booking, oldest first */
export async function listBookingReschedules(bookingId) {
  const rows = await query(
    `SELECT ${RESCHEDULE_COLUMNS} FROM booking_reschedules WHERE booking_id = ? ORDER BY created_at ASC, booking_reschedule_id`,
    [bookingId]
  );
  return rows.map(mapReschedule);
}

/**
 * Latest move per booking (for badges in booking lists).
 * @param {string[]} bookingIds
 * @returns {Promise<Map<string, ReturnType<typeof mapReschedule> & { moveCount: number, firstPrevious: object }>>}
 */
export async function getRescheduleSummaries(bookingIds) {
  if (!bookingIds.length) return new Map();
  const rows = await query(
    `SELECT ${RESCHEDULE_COLUMNS} FROM booking_reschedules
     WHERE booking_id IN (${bookingIds.map(() => '?').join(',')})
     ORDER BY created_at ASC, booking_reschedule_id`,
    bookingIds
  );
  const summaries = new Map();
  for (const row of rows.map(mapReschedule)) {
    const existing = summaries.get(row.bookingId);
    summaries.set(row.bookingId, { ...row, moveCount: (existing?.moveCount || 0) + 1, firstPrevious: existing?.firstPrevious || row.previous });
  }
  return summaries;
}

export async function countCustomerReschedules(bookingId) {
  const rows = await query(
    `SELECT COUNT(*) AS move_count FROM booking_reschedules WHERE booking_id = ? AND rescheduled_by = 'customer'`,
    [bookingId]
  );
  return Number(rows[0].move_count);
}

/**
 * Reschedules since an instant, by reason (analytics).
 * @param {Date} since
 */
export async function countReschedulesSince(since) {
  const rows = await query(
    `SELECT reschedule_reason, COUNT(*) AS move_count FROM booking_reschedules WHERE created_at >= ? GROUP BY reschedule_reason`,
    [since]
  );
  return Object.fromEntries(rows.map((row) => [row.reschedule_reason, Number(row.move_count)]));
}

/**
 * Create a customer link token for a booking. Returns the RAW token (only its hash is stored).
 * @param {string} bookingId
 */
export async function createRescheduleToken(bookingId) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO booking_access_tokens (access_token_id, booking_id, token_hash, token_purpose, expires_at)
     VALUES (?, ?, ?, 'reschedule', DATE_ADD(NOW(), INTERVAL ${ACCESS_TOKEN_DAYS} DAY))`,
    [crypto.randomUUID(), bookingId, hashToken(rawToken)]
  );
  return rawToken;
}

/**
 * @param {string} rawToken
 * @returns {Promise<string | null>} bookingId when the token is valid, unexpired and not revoked
 */
export async function findBookingIdByRescheduleToken(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 100) return null;
  const rows = await query(
    `SELECT booking_id FROM booking_access_tokens
     WHERE token_hash = ? AND token_purpose = 'reschedule' AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(rawToken)]
  );
  return rows[0]?.booking_id || null;
}
