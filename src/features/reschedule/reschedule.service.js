import 'server-only';
import pool from '@/lib/db';
import { getBookingById } from '@/features/booking/booking.repository';
import { loadAvailability, checkSlotBookable, getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { findNextAvailableSlot, getZonedNow, minutesToTime, timeToMinutes, parseSlotKey } from '@/features/schedule/slot-engine';
import {
  lockBookingSlot,
  moveBookingSlot,
  markBookingPendingReschedule,
  listPendingRescheduleBookings,
  countCustomerReschedules,
  findBookingIdByRescheduleToken,
} from '@/features/reschedule/reschedule.repository';
import { sendRescheduledEmails, sendReschedulePendingEmails } from '@/features/email/booking-emails';
import { CUSTOMER_RESCHEDULE_CUTOFF_HOURS, MAX_CUSTOMER_RESCHEDULES } from '@/features/schedule/schedule.definitions';

/** How far ahead an automatic move may look (beyond the customer booking window on purpose) */
export const AUTO_RESCHEDULE_SEARCH_DAYS = 30;
const MAX_CLAIM_ATTEMPTS = 10;

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
 * AUTOMATIC RESCHEDULE — no admin or consultant action needed.
 *
 * Moves a paid booking to the next free slot after its current time (later the same day first,
 * then the following days, up to 30 days ahead), claims it atomically (the unique confirmed-slot
 * key means a slot taken a split second earlier is skipped and the next one tried), records the
 * move and emails the customer and consultants.
 *
 * If no slot is free, the booking waits as `reschedule_required` and is retried automatically
 * whenever availability changes (see retryPendingReschedules).
 *
 * @param {string} bookingId
 * @param {{ reason: 'slot_taken'|'consultant_unavailable', rescheduledBy?: 'system'|'consultant',
 *   rescheduledByUserId?: string|null, notifyIfPending?: boolean }} options
 *   notifyIfPending: send the "no free time yet" emails when nothing is free (first attempt only).
 * @returns {Promise<{ outcome: 'moved', previous: object, next: object } | { outcome: 'pending' } | { outcome: 'skipped', why: string }>}
 */
export async function autoRescheduleBooking(bookingId, { reason, rescheduledBy = 'system', rescheduledByUserId = null, notifyIfPending = true }) {
  const booking = await getBookingById(bookingId);
  if (!booking || booking.payment?.paymentStatus !== 'paid') return { outcome: 'skipped', why: 'not_paid' };
  if (!['confirmed', 'reschedule_required'].includes(booking.bookingStatus)) return { outcome: 'skipped', why: booking.bookingStatus };

  const previous = { date: booking.consultationDate, startTime: booking.slotStartTime, endTime: booking.slotEndTime };
  const timezone = await getBusinessTimezone();
  const now = getZonedNow(timezone);
  // Search after the original time; if that is already past, from now
  const originalIsFuture = previous.date > now.date || (previous.date === now.date && timeToMinutes(previous.startTime) > now.minutes);
  const after = originalIsFuture ? { afterDate: previous.date, afterStartTime: previous.startTime } : { afterDate: now.date, afterStartTime: minutesToTime(now.minutes) };

  const tried = [];
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    const { days } = await loadAvailability({ days: AUTO_RESCHEDULE_SEARCH_DAYS });
    const next = findNextAvailableSlot(days, { ...after, excludeSlotKeys: tried });
    if (!next) break;

    try {
      const moved = await withTransaction(async (conn) => {
        const locked = await lockBookingSlot(conn, bookingId);
        // Something else moved it meanwhile (e.g. the customer) — don't overwrite
        if (!locked || locked.consultation_date !== previous.date || locked.slot_start_time !== previous.startTime) return false;
        await moveBookingSlot(conn, { bookingId, previous, next, reason, rescheduledBy, rescheduledByUserId });
        return true;
      });
      if (!moved) return { outcome: 'skipped', why: 'changed_concurrently' };

      console.info(`[Reschedule] ${bookingId.slice(0, 8)} moved ${previous.date} ${previous.startTime} → ${next.date} ${next.startTime} (${reason})`);
      void sendRescheduledEmails(bookingId, { previous, reason });
      return { outcome: 'moved', previous, next };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      tried.push(next.slotKey); // taken a split second ago — try the next one
    }
  }

  // Nothing free in the next 30 days: wait, and retry automatically when availability changes
  const wasAlreadyPending = booking.bookingStatus === 'reschedule_required';
  await withTransaction((conn) => markBookingPendingReschedule(conn, bookingId, reason));
  if (notifyIfPending && !wasAlreadyPending) void sendReschedulePendingEmails(bookingId);
  console.warn(`[Reschedule] ${bookingId.slice(0, 8)}: no free slot in ${AUTO_RESCHEDULE_SEARCH_DAYS} days — waiting`);
  return { outcome: 'pending' };
}

let retryInProgress = null;

/**
 * Retry every paid booking that is waiting for a slot. Called whenever availability may have
 * grown (time off removed, hours changed) and when the consultant dashboard/bookings load.
 * Cheap when nothing is pending; concurrent calls share one run.
 * @returns {Promise<{ moved: number, stillPending: number }>}
 */
export function retryPendingReschedules() {
  if (retryInProgress) return retryInProgress;
  retryInProgress = (async () => {
    let moved = 0;
    let stillPending = 0;
    try {
      for (const pending of await listPendingRescheduleBookings()) {
        const result = await autoRescheduleBooking(pending.bookingId, { reason: pending.reason, notifyIfPending: false });
        if (result.outcome === 'moved') moved++;
        else if (result.outcome === 'pending') stillPending++;
      }
    } catch (err) {
      console.error('[Reschedule] Retry run failed:', err.message);
    } finally {
      retryInProgress = null;
    }
    return { moved, stillPending };
  })();
  return retryInProgress;
}

/**
 * What a customer with a valid link may do right now.
 * @param {string} rawToken
 */
export async function getCustomerRescheduleContext(rawToken) {
  const bookingId = await findBookingIdByRescheduleToken(rawToken);
  if (!bookingId) return { ok: false, reason: 'invalid_link' };
  const booking = await getBookingById(bookingId);
  if (!booking || booking.payment?.paymentStatus !== 'paid') return { ok: false, reason: 'invalid_link' };

  const [timezone, used] = await Promise.all([getBusinessTimezone(), countCustomerReschedules(bookingId)]);
  const now = getZonedNow(timezone);
  const daysUntil = Math.round((Date.parse(`${booking.consultationDate}T00:00:00Z`) - Date.parse(`${now.date}T00:00:00Z`)) / 86400000);
  const minutesUntilStart = daysUntil * 1440 + timeToMinutes(booking.slotStartTime) - now.minutes;

  let blockedReason = null;
  if (booking.bookingStatus === 'reschedule_required') blockedReason = 'pending';
  else if (minutesUntilStart <= 0) blockedReason = 'started';
  else if (used >= MAX_CUSTOMER_RESCHEDULES) blockedReason = 'limit_reached';
  else if (minutesUntilStart < CUSTOMER_RESCHEDULE_CUTOFF_HOURS * 60) blockedReason = 'too_late';

  return {
    ok: true,
    booking,
    cutoffHours: CUSTOMER_RESCHEDULE_CUTOFF_HOURS,
    changesUsed: used,
    changesLeft: Math.max(MAX_CUSTOMER_RESCHEDULES - used, 0),
    canReschedule: !blockedReason,
    blockedReason,
  };
}

/**
 * The customer picks a new time from their link.
 * @param {string} rawToken
 * @param {string} slotKey - "YYYY-MM-DDTHH:MM"
 * @returns {Promise<{ ok: true, previous: object, next: object } | { ok: false, status: number, error: string }>}
 */
export async function rescheduleByCustomer(rawToken, slotKey) {
  const context = await getCustomerRescheduleContext(rawToken);
  if (!context.ok) return { ok: false, status: 404, error: 'This link is invalid or has expired.' };
  if (!context.canReschedule) {
    const messages = {
      pending: 'We are already finding a new time for this booking — you will receive an email shortly.',
      started: 'This consultation has already started or passed.',
      limit_reached: 'You have already changed this booking the maximum number of times. Please reply to your confirmation email.',
      too_late: `Changes are possible up to ${CUSTOMER_RESCHEDULE_CUTOFF_HOURS} hours before the consultation. Please reply to your confirmation email.`,
    };
    return { ok: false, status: 409, error: messages[context.blockedReason] };
  }

  const target = parseSlotKey(slotKey);
  if (!target) return { ok: false, status: 400, error: 'Please choose a time.' };
  const { booking } = context;
  if (target.date === booking.consultationDate && target.startTime === booking.slotStartTime) {
    return { ok: false, status: 400, error: 'That is already your booking time.' };
  }

  const check = await checkSlotBookable(target.date, target.startTime);
  if (!check.ok) return { ok: false, status: 409, error: 'This time is no longer available. Please choose another one.' };

  const previous = { date: booking.consultationDate, startTime: booking.slotStartTime, endTime: booking.slotEndTime };
  const next = { date: target.date, startTime: check.slot.startTime, endTime: check.slot.endTime, label: check.slot.label };
  try {
    const moved = await withTransaction(async (conn) => {
      const locked = await lockBookingSlot(conn, booking.bookingId);
      if (!locked || locked.booking_status !== 'confirmed' || locked.consultation_date !== previous.date || locked.slot_start_time !== previous.startTime) {
        return false;
      }
      await moveBookingSlot(conn, { bookingId: booking.bookingId, previous, next, reason: 'customer_request', rescheduledBy: 'customer' });
      return true;
    });
    if (!moved) return { ok: false, status: 409, error: 'Your booking changed in the meantime. Please reload the page.' };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { ok: false, status: 409, error: 'This time was just booked by someone else. Please choose another one.' };
    throw err;
  }

  void sendRescheduledEmails(booking.bookingId, { previous, reason: 'customer_request' });
  void retryPendingReschedules(); // the old slot is free again
  return { ok: true, previous, next };
}
