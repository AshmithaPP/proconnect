/**
 * Consultant-managed booking rules and weekly hours: defaults + validation.
 * Client-safe — shared by the Schedule page and the API.
 */
import { timeToMinutes } from '@/features/schedule/slot-engine';

export const BOOKING_RULES_DEFAULTS = {
  bookingWindowDays: 7,
  minNoticeMinutes: 60,
  slotDurationMinutes: 30,
  slotGapMinutes: 0,
  consultationFeePaise: 99900,
  customerRescheduleCutoffHours: 12,
  maxCustomerReschedules: 2,
};

export const BOOKING_RULE_LIMITS = {
  bookingWindowDays: { min: 1, max: 60, label: 'Booking window' },
  minNoticeMinutes: { min: 0, max: 10080, label: 'Minimum notice' },
  slotDurationMinutes: { min: 15, max: 240, label: 'Slot length' },
  slotGapMinutes: { min: 0, max: 120, label: 'Gap between slots' },
  customerRescheduleCutoffHours: { min: 0, max: 168, label: 'Change cut-off' },
  maxCustomerReschedules: { min: 0, max: 10, label: 'Changes allowed' },
};

const MAX_FEE_PAISE = 10000000; // ₹1,00,000

/**
 * @param {object} input - fee may be given in rupees as `consultationFeeRupees`
 * @returns {{ value: typeof BOOKING_RULES_DEFAULTS, fieldErrors: Record<string, string> }}
 */
export function validateBookingRules(input) {
  const body = input && typeof input === 'object' ? input : {};
  const fieldErrors = {};
  const value = {};

  for (const [key, { min, max, label }] of Object.entries(BOOKING_RULE_LIMITS)) {
    const number = Number(body[key]);
    if (!Number.isInteger(number) || number < min || number > max) {
      fieldErrors[key] = `${label} must be a whole number between ${min} and ${max}`;
    }
    value[key] = number;
  }

  const rupees = Number(body.consultationFeeRupees);
  const feePaise = Math.round(rupees * 100);
  if (!Number.isFinite(rupees) || feePaise < 100 || feePaise > MAX_FEE_PAISE || Math.abs(rupees * 100 - feePaise) > 1e-6) {
    fieldErrors.consultationFeeRupees = 'Fee must be between ₹1 and ₹1,00,000 (up to 2 decimals)';
  }
  value.consultationFeePaise = feePaise;

  return { value, fieldErrors };
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Weekly hours: [{ weekday: 0-6, startTime: "HH:MM", endTime: "HH:MM" }, …]
 * Ranges on the same day must not overlap. A day without ranges is closed.
 * @returns {{ value: Array<{ weekday: number, startTime: string, endTime: string }>, error: string | null }}
 */
export function validateWeeklyHours(input) {
  if (!Array.isArray(input) || input.length > 70) return { value: [], error: 'Invalid weekly hours' };

  const value = [];
  for (const range of input) {
    const weekday = Number(range?.weekday);
    const startTime = String(range?.startTime || '');
    const endTime = String(range?.endTime || '');
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { value: [], error: 'Invalid weekday' };
    if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
      return { value: [], error: 'Times must be in HH:MM (24-hour) format' };
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return { value: [], error: 'Each end time must be after its start time' };
    }
    value.push({ weekday, startTime, endTime });
  }

  for (let weekday = 0; weekday <= 6; weekday++) {
    const day = value.filter((r) => r.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) {
      if (timeToMinutes(day[i].startTime) < timeToMinutes(day[i - 1].endTime)) {
        return { value: [], error: 'Time ranges on the same day must not overlap' };
      }
    }
  }
  return { value, error: null };
}
