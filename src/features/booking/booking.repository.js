import 'server-only';
import crypto from 'crypto';
import pool, { query } from '@/lib/db';

/**
 * Run a callback inside a MySQL transaction on a dedicated connection.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/*
 * Slot occupancy is decided by the slot engine (features/schedule): a slot is taken only by
 * a `confirmed` booking (= paid). Pending, cancelled and failed attempts never block a slot.
 * The database enforces it too: unique key uq_confirmed_slot allows ONE confirmed booking
 * per consultation_date + slot_start_time.
 */

/**
 * Mark a booking and its payment as cancelled when customer cancels or payment fails.
 * This explicitly ensures the slot remains free.
 * @param {string} bookingId
 */
export async function markBookingCancelled(bookingId) {
  if (!bookingId) return;
  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE consultation_bookings
       SET booking_status = 'cancelled'
       WHERE booking_id = ? AND booking_status = 'pending_payment'`,
      [bookingId]
    );
    await conn.execute(
      `UPDATE booking_payments
       SET payment_status = 'failed'
       WHERE booking_id = ? AND payment_status = 'pending'`,
      [bookingId]
    );
  });
}

/**
 * Create a booking together with its pending payment record (atomic).
 * The caller must have checked the slot with checkSlotBookable() first; the slot is only
 * claimed when the payment is confirmed (see markBookingPaymentSucceeded).
 *
 * @param {Object} params
 * @param {Object} params.booking - normalized output of validateBookingInput() plus
 *   consultationDate, slotStartTime, slotEndTime, preferredTimeSlot (label)
 * @param {number} params.amountPaise
 * @param {string} params.currencyCode
 * @returns {Promise<{ bookingId: string, paymentId: string }>}
 */
export async function createBookingWithPendingPayment({ booking, amountPaise, currencyCode }) {
  const bookingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();

  await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO consultation_bookings (
         booking_id, full_name, company_name, work_email, phone_number,
         user_role, user_role_other, sales_team_size,
         sales_challenge, sales_challenge_other, preferred_time_slot,
         consultation_date, slot_start_time, slot_end_time, booking_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
      [
        bookingId,
        booking.fullName,
        booking.companyName,
        booking.workEmail,
        booking.phoneNumber,
        booking.userRole,
        booking.userRoleOther,
        booking.salesTeamSize,
        booking.salesChallenge,
        booking.salesChallengeOther,
        booking.preferredTimeSlot,
        booking.consultationDate,
        booking.slotStartTime,
        booking.slotEndTime,
      ]
    );

    await conn.execute(
      `INSERT INTO booking_payments (payment_id, booking_id, amount_paise, currency_code, payment_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [paymentId, bookingId, amountPaise, currencyCode]
    );
  });

  return { bookingId, paymentId };
}

/**
 * Mark a booking's pending payment as paid and confirm the booking (atomic, idempotent).
 * This is the single entry point a real gateway webhook should call later.
 *
 * If another booking was confirmed for the same slot first (two customers paying at the
 * same moment), the database rejects the second confirmation: the payment is still recorded
 * as paid and the booking becomes `reschedule_required` — the customer keeps their payment
 * and picks another time.
 *
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.paymentProvider - e.g. "worldline"
 * @param {string} params.providerPaymentId
 * @param {string} [params.providerOrderId]
 * @returns {Promise<{ outcome: 'paid' | 'paid_needs_reschedule' | 'already_paid' | 'not_found', paymentId?: string, paidAt?: Date }>}
 */
export async function markBookingPaymentSucceeded({
  bookingId,
  paymentProvider,
  providerPaymentId,
  providerOrderId = null,
}) {
  return withTransaction(async (conn) => {
    // Lock the booking's latest payment row so concurrent confirmations cannot double-apply
    const [rows] = await conn.execute(
      `SELECT p.payment_id, p.payment_status, p.paid_at
       FROM booking_payments p
       JOIN consultation_bookings b ON b.booking_id = p.booking_id
       WHERE p.booking_id = ? AND b.booking_status <> 'cancelled'
       ORDER BY p.created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [bookingId]
    );

    if (rows.length === 0) {
      return { outcome: 'not_found' };
    }

    const payment = rows[0];
    if (payment.payment_status === 'paid') {
      return { outcome: 'already_paid', paymentId: payment.payment_id, paidAt: payment.paid_at };
    }

    await conn.execute(
      `UPDATE booking_payments
       SET payment_status = 'paid',
           payment_provider = ?,
           provider_payment_id = ?,
           provider_order_id = ?,
           paid_at = NOW()
       WHERE payment_id = ?`,
      [paymentProvider, providerPaymentId, providerOrderId, payment.payment_id]
    );

    let outcome = 'paid';
    try {
      await conn.execute(`UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`, [bookingId]);
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      // Slot already confirmed for someone else (uq_confirmed_slot)
      await conn.execute(`UPDATE consultation_bookings SET booking_status = 'reschedule_required' WHERE booking_id = ?`, [bookingId]);
      outcome = 'paid_needs_reschedule';
    }

    const [updated] = await conn.execute(
      `SELECT paid_at FROM booking_payments WHERE payment_id = ?`,
      [payment.payment_id]
    );

    return { outcome, paymentId: payment.payment_id, paidAt: updated[0].paid_at };
  });
}

/**
 * Status derived from booking + latest payment:
 *  - paid                → payment captured, booking confirmed
 *  - reschedule_required → paid, but the slot must be moved (taken / blocked)
 *  - pending             → submitted, waiting for payment
 *  - cancelled           → customer cancelled / payment failed (slot released)
 *  - no_payment          → booking row has no payment record (e.g. payment row deleted manually)
 */
function deriveBookingStatus(row) {
  if (!row.payment_id) return 'no_payment';
  if (row.booking_status === 'reschedule_required') return 'reschedule_required';
  if (row.payment_status === 'paid') return 'paid';
  if (row.booking_status === 'cancelled' || row.payment_status === 'failed') return 'cancelled';
  return 'pending';
}

function mapBookingRow(row) {
  return {
    bookingId: row.booking_id,
    fullName: row.full_name,
    companyName: row.company_name,
    workEmail: row.work_email,
    phoneNumber: row.phone_number,
    userRole: row.user_role,
    userRoleOther: row.user_role_other,
    salesTeamSize: row.sales_team_size,
    salesChallenge: row.sales_challenge,
    salesChallengeOther: row.sales_challenge_other,
    preferredTimeSlot: row.preferred_time_slot,
    consultationDate: row.consultation_date,
    slotStartTime: row.slot_start_time,
    slotEndTime: row.slot_end_time,
    bookingStatus: row.booking_status,
    status: deriveBookingStatus(row),
    bookedAt: row.created_at,
    payment: row.payment_id
      ? {
          paymentId: row.payment_id,
          paymentProvider: row.payment_provider,
          providerOrderId: row.provider_order_id,
          providerPaymentId: row.provider_payment_id,
          amountPaise: row.amount_paise,
          currencyCode: row.currency_code,
          paymentStatus: row.payment_status,
          paidAt: row.paid_at,
        }
      : null,
  };
}

/** Joins each booking to its LATEST payment row (if any). Booking table alias `b`, payment alias `p`. */
const BOOKING_WITH_LATEST_PAYMENT = `
  FROM consultation_bookings b
  LEFT JOIN booking_payments p ON p.payment_id = (
    SELECT lp.payment_id FROM booking_payments lp
    WHERE lp.booking_id = b.booking_id
    ORDER BY lp.created_at DESC
    LIMIT 1
  )`;

const BOOKING_COLUMNS = `
  b.booking_id, b.full_name, b.company_name, b.work_email, b.phone_number,
  b.user_role, b.user_role_other, b.sales_team_size,
  b.sales_challenge, b.sales_challenge_other, b.preferred_time_slot,
  DATE_FORMAT(b.consultation_date, '%Y-%m-%d') AS consultation_date,
  TIME_FORMAT(b.slot_start_time, '%H:%i') AS slot_start_time,
  TIME_FORMAT(b.slot_end_time, '%H:%i') AS slot_end_time,
  b.booking_status, b.created_at,
  p.payment_id, p.payment_provider, p.provider_order_id, p.provider_payment_id,
  p.amount_paise, p.currency_code, p.payment_status, p.paid_at`;

/** A booking counts only once it is confirmed AND its latest payment is paid. */
const PAID_BOOKING_SQL = `p.payment_status = 'paid' AND b.booking_status = 'confirmed'`;

/**
 * Booking views for the consultant / admin Bookings page. `today` is the business-timezone
 * date ("YYYY-MM-DD") — never the DB server's CURDATE().
 */
const BOOKING_VIEWS = {
  upcoming: { where: `${PAID_BOOKING_SQL} AND b.consultation_date >= ?`, order: 'b.consultation_date ASC, b.slot_start_time ASC', usesToday: true },
  today: { where: `${PAID_BOOKING_SQL} AND b.consultation_date = ?`, order: 'b.slot_start_time ASC', usesToday: true },
  past: { where: `${PAID_BOOKING_SQL} AND b.consultation_date < ?`, order: 'b.consultation_date DESC, b.slot_start_time DESC', usesToday: true },
  reschedule: { where: `b.booking_status = 'reschedule_required' AND p.payment_status = 'paid'`, order: 'p.paid_at ASC', usesToday: false },
};

export const BOOKING_VIEW_KEYS = Object.keys(BOOKING_VIEWS);

/**
 * @param {{ view: 'upcoming'|'today'|'past'|'reschedule', today: string, page?: number, pageSize?: number, search?: string }} params
 * @returns {Promise<{ bookings: object[], totalCount: number }>}
 */
export async function listBookingsForView({ view, today, page = 1, pageSize = 20, search = '' }) {
  const config = BOOKING_VIEWS[view] || BOOKING_VIEWS.upcoming;
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safePageSize;

  let where = config.where;
  const params = config.usesToday ? [today] : [];
  const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (term) {
    where += ' AND (b.full_name LIKE ? OR b.company_name LIKE ? OR b.work_email LIKE ? OR b.phone_number LIKE ?)';
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like, like);
  }

  // LIMIT/OFFSET are inlined as validated integers; mysql2 prepared statements reject them as params
  const rows = await query(
    `SELECT ${BOOKING_COLUMNS} ${BOOKING_WITH_LATEST_PAYMENT}
     WHERE ${where}
     ORDER BY ${config.order}
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params
  );
  const countRows = await query(`SELECT COUNT(*) AS total_count ${BOOKING_WITH_LATEST_PAYMENT} WHERE ${where}`, params);

  return { bookings: rows.map(mapBookingRow), totalCount: Number(countRows[0].total_count) };
}

/**
 * Counts for the Bookings page tabs.
 * @param {string} today - business-timezone date
 */
export async function getBookingViewCounts(today) {
  const rows = await query(
    `SELECT
       COALESCE(SUM(${PAID_BOOKING_SQL} AND b.consultation_date >= ?), 0) AS upcoming_count,
       COALESCE(SUM(${PAID_BOOKING_SQL} AND b.consultation_date = ?), 0) AS today_count,
       COALESCE(SUM(${PAID_BOOKING_SQL} AND b.consultation_date < ?), 0) AS past_count,
       COALESCE(SUM(b.booking_status = 'reschedule_required' AND p.payment_status = 'paid'), 0) AS reschedule_count
     ${BOOKING_WITH_LATEST_PAYMENT}`,
    [today, today, today]
  );
  const row = rows[0];
  return {
    upcoming: Number(row.upcoming_count),
    today: Number(row.today_count),
    past: Number(row.past_count),
    reschedule: Number(row.reschedule_count),
  };
}

/**
 * Headline totals over paid & confirmed bookings (admin overview).
 * @returns {Promise<{ paidBookingCount: number, totalRevenuePaise: number }>}
 */
export async function getPaidBookingStats() {
  const rows = await query(
    `SELECT COUNT(*) AS paid_booking_count, COALESCE(SUM(p.amount_paise), 0) AS total_revenue_paise
     ${BOOKING_WITH_LATEST_PAYMENT}
     WHERE ${PAID_BOOKING_SQL}`
  );

  const row = rows[0];
  return {
    paidBookingCount: Number(row.paid_booking_count),
    totalRevenuePaise: Number(row.total_revenue_paise),
  };
}

/**
 * Retrieve a booking and its latest payment details by booking UUID.
 * @param {string} bookingId
 * @returns {Promise<Object|null>}
 */
export async function getBookingById(bookingId) {
  const rows = await query(
    `SELECT ${BOOKING_COLUMNS}
     ${BOOKING_WITH_LATEST_PAYMENT}
     WHERE b.booking_id = ?
     LIMIT 1`,
    [bookingId]
  );

  if (!rows || rows.length === 0) return null;
  return mapBookingRow(rows[0]);
}

/**
 * Save gateway order / session ID (hostedCheckoutId) to the pending payment record.
 * @param {string} bookingId
 * @param {string} providerOrderId
 * @param {string} paymentProvider
 */
export async function updateBookingPaymentOrderId(bookingId, providerOrderId, paymentProvider = 'worldline') {
  await query(
    `UPDATE booking_payments
     SET provider_order_id = ?, payment_provider = ?
     WHERE booking_id = ? AND payment_status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [providerOrderId, paymentProvider, bookingId]
  );
}

/**
 * Find booking by gateway order / session ID (hostedCheckoutId).
 * @param {string} providerOrderId
 * @returns {Promise<Object|null>}
 */
export async function getBookingByProviderOrderId(providerOrderId) {
  const rows = await query(
    `SELECT ${BOOKING_COLUMNS}
     FROM consultation_bookings b
     JOIN booking_payments p ON p.booking_id = b.booking_id
     WHERE p.provider_order_id = ?
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [providerOrderId]
  );

  if (!rows || rows.length === 0) return null;
  return mapBookingRow(rows[0]);
}
