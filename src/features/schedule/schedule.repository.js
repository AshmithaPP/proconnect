import 'server-only';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { readStoredSetting, writeSetting, getSetting } from '@/features/settings/settings.repository';
import { BOOKING_RULES_DEFAULTS } from '@/features/schedule/schedule.definitions';
import { buildAvailability, addDays, getZonedNow, BUSINESS_HOURS } from '@/features/schedule/slot-engine';

const BOOKING_RULES_KEY = 'booking_rules';

/**
 * Booking rules set by the consultant (fee, booking window, slot length, reschedule limits).
 * The fee falls back to CONSULTATION_FEE_PAISE from .env until the consultant saves one.
 * Only known rules are returned (keys of settings that no longer exist are ignored).
 */
export async function getBookingRules() {
  const envFee = Number(process.env.CONSULTATION_FEE_PAISE);
  const stored = await readStoredSetting(BOOKING_RULES_KEY);
  const rules = {
    ...BOOKING_RULES_DEFAULTS,
    ...(Number.isInteger(envFee) && envFee > 0 ? { consultationFeePaise: envFee } : {}),
  };
  for (const key of Object.keys(BOOKING_RULES_DEFAULTS)) {
    if (stored[key] !== undefined) rules[key] = stored[key];
  }
  return rules;
}

/** @param {typeof BOOKING_RULES_DEFAULTS} rules - validated */
export async function saveBookingRules(rules, updatedByUserId) {
  await writeSetting(BOOKING_RULES_KEY, rules, updatedByUserId);
}

/** Business timezone from Settings → General */
export async function getBusinessTimezone() {
  return (await getSetting('general')).timezone || 'Asia/Kolkata';
}

/** Time off between two dates (inclusive) */
export async function listTimeOff(fromDate, toDate) {
  const rows = await query(
    `SELECT time_off_id, DATE_FORMAT(off_date, '%Y-%m-%d') AS off_date,
            TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time, time_off_reason
     FROM schedule_time_off WHERE off_date BETWEEN ? AND ? ORDER BY off_date, start_time`,
    [fromDate, toDate]
  );
  return rows.map((row) => ({
    timeOffId: row.time_off_id,
    offDate: row.off_date,
    startTime: row.start_time,
    endTime: row.end_time,
    timeOffReason: row.time_off_reason,
  }));
}

/**
 * @param {{ offDate: string, startTime?: string|null, endTime?: string|null, timeOffReason?: string|null, createdByUserId: string }} timeOff
 * @returns {Promise<string>} timeOffId
 */
export async function addTimeOff({ offDate, startTime = null, endTime = null, timeOffReason = null, createdByUserId }) {
  const timeOffId = crypto.randomUUID();
  await query(
    `INSERT INTO schedule_time_off (time_off_id, off_date, start_time, end_time, time_off_reason, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [timeOffId, offDate, startTime, endTime, timeOffReason, createdByUserId]
  );
  return timeOffId;
}

/** @returns {Promise<boolean>} whether a row was removed */
export async function removeTimeOff(timeOffId) {
  const result = await query('DELETE FROM schedule_time_off WHERE time_off_id = ?', [timeOffId]);
  return result.affectedRows > 0;
}

/** Remove a whole-day block plus any slot blocks on that date (used when re-opening a day) */
export async function removeTimeOffForDate(offDate) {
  await query('DELETE FROM schedule_time_off WHERE off_date = ?', [offDate]);
}

/**
 * Confirmed bookings between two dates — the slots they occupy.
 * @param {string} fromDate
 * @param {string} toDate
 * @param {import('mysql2/promise').PoolConnection} [conn] - inside a transaction, locks the rows
 */
export async function listConfirmedBookingSlots(fromDate, toDate, conn) {
  const sql = `SELECT booking_id, full_name, company_name,
            DATE_FORMAT(consultation_date, '%Y-%m-%d') AS consultation_date,
            TIME_FORMAT(slot_start_time, '%H:%i') AS slot_start_time, TIME_FORMAT(slot_end_time, '%H:%i') AS slot_end_time
     FROM consultation_bookings
     WHERE booking_status = 'confirmed' AND consultation_date BETWEEN ? AND ?${conn ? ' FOR UPDATE' : ''}`;
  const rows = conn ? (await conn.execute(sql, [fromDate, toDate]))[0] : await query(sql, [fromDate, toDate]);
  return rows.map((row) => ({
    bookingId: row.booking_id,
    fullName: row.full_name,
    companyName: row.company_name,
    consultationDate: row.consultation_date,
    slotStartTime: row.slot_start_time,
    slotEndTime: row.slot_end_time,
  }));
}

/**
 * Everything the slot engine needs, loaded and combined.
 * @param {{ fromDate?: string, days?: number, conn?: import('mysql2/promise').PoolConnection }} [options]
 *   Default: the customer booking window starting today.
 */
export async function loadAvailability({ fromDate, days, conn } = {}) {
  const [rules, timezone] = await Promise.all([getBookingRules(), getBusinessTimezone()]);
  const startDate = fromDate || getZonedNow(timezone).date;
  const dayCount = days || rules.bookingWindowDays;
  const endDate = addDays(startDate, dayCount - 1);
  const [timeOff, bookings] = await Promise.all([
    listTimeOff(startDate, endDate),
    listConfirmedBookingSlots(startDate, endDate, conn),
  ]);

  return {
    rules,
    timezone,
    businessHours: BUSINESS_HOURS,
    days: buildAvailability({ rules, timeOff, bookings, timezone, fromDate: startDate, days: dayCount }),
  };
}

/**
 * Re-check one slot for a customer: inside the booking window, within hours, not past,
 * not blocked, not booked.
 * @param {string} date
 * @param {string} startTime
 * @param {{ excludeBookingId?: string, conn?: import('mysql2/promise').PoolConnection }} [options]
 * @returns {Promise<{ ok: true, slot: object, rules: object } | { ok: false, reason: string }>}
 */
export async function checkSlotBookable(date, startTime, { excludeBookingId, conn } = {}) {
  const { rules, days } = await loadAvailability({ conn });
  const day = days.find((d) => d.date === date);
  if (!day) return { ok: false, reason: 'outside_window' };

  const slot = day.slots.find((s) => s.startTime === startTime && !s.outsideHours);
  if (!slot) return { ok: false, reason: 'not_a_slot' };
  if (slot.status === 'booked' && excludeBookingId && slot.booking?.bookingId === excludeBookingId) {
    return { ok: true, slot, rules };
  }
  if (slot.status !== 'available') return { ok: false, reason: slot.status };
  return { ok: true, slot, rules };
}
