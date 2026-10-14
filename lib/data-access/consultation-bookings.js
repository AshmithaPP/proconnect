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

/**
 * Retrieve list of time slots that are currently booked today.
 * STRICT RULE: Only confirmed (paid) bookings mark a slot as unavailable.
 * Cancelled, pending, or failed attempts NEVER cut off or block the slot.
 * 
 * @returns {Promise<string[]>} Array of unavailable slot strings
 */
export async function getUnavailableTimeSlots() {
  const rows = await query(
    `SELECT DISTINCT preferred_time_slot
     FROM consultation_bookings
     WHERE DATE(created_at) = CURDATE()
       AND booking_status = 'confirmed'`
  );

  return rows.map((r) => r.preferred_time_slot);
}

/**
 * Mark a booking and its payment as cancelled when customer cancels or payment fails.
 * This explicitly ensures the slot remains free.
 * @param {string} bookingId
 */
export async function markBookingCancelled(bookingId) {
  if (!bookingId) return;
  await query(
    `UPDATE consultation_bookings
     SET booking_status = 'cancelled'
     WHERE booking_id = ? AND booking_status = 'pending_payment'`,
    [bookingId]
  );
  await query(
    `UPDATE booking_payments
     SET payment_status = 'failed'
     WHERE booking_id = ? AND payment_status = 'pending'`,
    [bookingId]
  );
}

/**
 * Create a booking together with its pending payment record (atomic).
 * Enforces strict backend validation with row-level locking (FOR UPDATE)
 * to guarantee that a slot cannot be double-booked if already paid/confirmed.
 * 
 * @param {Object} params
 * @param {Object} params.booking - normalized output of validateBookingInput()
 * @param {number} params.amountPaise
 * @param {string} params.currencyCode
 * @returns {Promise<{ bookingId: string, paymentId: string }>}
 */
export async function createBookingWithPendingPayment({ booking, amountPaise, currencyCode }) {
  const bookingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();

  await withTransaction(async (conn) => {
    // 1. Strict concurrency lock: Only paid/confirmed bookings block a slot
    const [existing] = await conn.execute(
      `SELECT booking_id, full_name, booking_status, created_at
       FROM consultation_bookings
       WHERE preferred_time_slot = ?
         AND DATE(created_at) = CURDATE()
         AND booking_status = 'confirmed'
       LIMIT 1
       FOR UPDATE`,
      [booking.preferredTimeSlot]
    );

    if (existing.length > 0) {
      const conflict = existing[0];
      const err = new Error(
        `The time slot "${booking.preferredTimeSlot}" is already booked.`
      );
      err.code = 'SLOT_ALREADY_BOOKED';
      err.timeSlot = booking.preferredTimeSlot;
      err.bookingStatus = conflict.booking_status;
      throw err;
    }

    // 2. Insert booking with pending payment
    await conn.execute(
      `INSERT INTO consultation_bookings (
         booking_id, full_name, company_name, work_email, phone_number,
         user_role, user_role_other, sales_team_size,
         sales_challenge, sales_challenge_other, preferred_time_slot, booking_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
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
 * @param {Object} params
 * @param {string} params.bookingId
 * @param {string} params.paymentProvider - e.g. "mock", "razorpay"
 * @param {string} params.providerPaymentId
 * @param {string} [params.providerOrderId]
 * @returns {Promise<{ outcome: 'paid' | 'already_paid' | 'not_found', paymentId?: string, paidAt?: Date }>}
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

    await conn.execute(
      `UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`,
      [bookingId]
    );

    const [updated] = await conn.execute(
      `SELECT paid_at FROM booking_payments WHERE payment_id = ?`,
      [payment.payment_id]
    );

    return { outcome: 'paid', paymentId: payment.payment_id, paidAt: updated[0].paid_at };
  });
}

function mapPaidBookingRow(row) {
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
    bookingStatus: row.booking_status,
    bookedAt: row.created_at,
    payment: {
      paymentId: row.payment_id,
      paymentProvider: row.payment_provider,
      providerPaymentId: row.provider_payment_id,
      amountPaise: row.amount_paise,
      currencyCode: row.currency_code,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at,
    },
  };
}

/**
 * List paid (confirmed) bookings, most recently paid first.
 * @param {Object} params
 * @param {number} params.page - 1-based
 * @param {number} params.pageSize
 * @returns {Promise<{ bookings: object[], totalCount: number }>}
 */
export async function listPaidBookings({ page = 1, pageSize = 20 }) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safePageSize;

  // LIMIT/OFFSET are inlined as validated integers; mysql2 prepared statements reject them as params
  const rows = await query(
    `SELECT
       b.booking_id, b.full_name, b.company_name, b.work_email, b.phone_number,
       b.user_role, b.user_role_other, b.sales_team_size,
       b.sales_challenge, b.sales_challenge_other, b.preferred_time_slot,
       b.booking_status, b.created_at,
       p.payment_id, p.payment_provider, p.provider_payment_id,
       p.amount_paise, p.currency_code, p.payment_status, p.paid_at
     FROM consultation_bookings b
     JOIN booking_payments p ON p.booking_id = b.booking_id
     WHERE p.payment_status = 'paid'
     ORDER BY p.paid_at DESC
     LIMIT ${safePageSize} OFFSET ${offset}`
  );

  const countRows = await query(
    `SELECT COUNT(*) AS total_count FROM booking_payments WHERE payment_status = 'paid'`
  );

  return {
    bookings: rows.map(mapPaidBookingRow),
    totalCount: Number(countRows[0].total_count),
  };
}

/**
 * Aggregate booking KPIs for the admin dashboard.
 * @returns {Promise<{ paidBookingCount: number, paidTodayCount: number, totalRevenuePaise: number, pendingPaymentCount: number }>}
 */
export async function getBookingStats() {
  const rows = await query(
    `SELECT
       COALESCE(SUM(payment_status = 'paid'), 0) AS paid_booking_count,
       COALESCE(SUM(payment_status = 'paid' AND paid_at >= CURDATE()), 0) AS paid_today_count,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_paise ELSE 0 END), 0) AS total_revenue_paise,
       COALESCE(SUM(payment_status = 'pending'), 0) AS pending_payment_count
     FROM booking_payments`
  );

  const row = rows[0];
  return {
    paidBookingCount: Number(row.paid_booking_count),
    paidTodayCount: Number(row.paid_today_count),
    totalRevenuePaise: Number(row.total_revenue_paise),
    pendingPaymentCount: Number(row.pending_payment_count),
  };
}

/**
 * Retrieve a booking and its latest payment details by booking UUID.
 * @param {string} bookingId
 * @returns {Promise<Object|null>}
 */
export async function getBookingById(bookingId) {
  const rows = await query(
    `SELECT
       b.booking_id, b.full_name, b.company_name, b.work_email, b.phone_number,
       b.user_role, b.user_role_other, b.sales_team_size,
       b.sales_challenge, b.sales_challenge_other, b.preferred_time_slot,
       b.booking_status, b.created_at,
       p.payment_id, p.payment_provider, p.provider_order_id, p.provider_payment_id,
       p.amount_paise, p.currency_code, p.payment_status, p.paid_at
     FROM consultation_bookings b
     LEFT JOIN booking_payments p ON p.booking_id = b.booking_id
     WHERE b.booking_id = ?
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [bookingId]
  );

  if (!rows || rows.length === 0) return null;
  return mapPaidBookingRow(rows[0]);
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
    `SELECT
       b.booking_id, b.full_name, b.company_name, b.work_email, b.phone_number,
       b.user_role, b.user_role_other, b.sales_team_size,
       b.sales_challenge, b.sales_challenge_other, b.preferred_time_slot,
       b.booking_status, b.created_at,
       p.payment_id, p.payment_provider, p.provider_order_id, p.provider_payment_id,
       p.amount_paise, p.currency_code, p.payment_status, p.paid_at
     FROM consultation_bookings b
     JOIN booking_payments p ON p.booking_id = b.booking_id
     WHERE p.provider_order_id = ?
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [providerOrderId]
  );

  if (!rows || rows.length === 0) return null;
  return mapPaidBookingRow(rows[0]);
}

