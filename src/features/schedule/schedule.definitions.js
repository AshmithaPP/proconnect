/**
 * Consultant-managed booking rules: defaults + validation. (Business hours are fixed — see
 * BUSINESS_HOURS in the slot engine.)
 * Client-safe — shared by the Schedule page and the API.
 */

export const BOOKING_RULES_DEFAULTS = {
  bookingWindowDays: 7,
  slotDurationMinutes: 30,
  consultationFeePaise: 99900,
  customerRescheduleCutoffHours: 12,
  maxCustomerReschedules: 2,
};

export const BOOKING_RULE_LIMITS = {
  bookingWindowDays: { min: 1, max: 60, label: 'Booking window' },
  slotDurationMinutes: { min: 15, max: 240, label: 'Slot length' },
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
