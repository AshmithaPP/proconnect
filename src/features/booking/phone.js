/**
 * Indian mobile number validation (shared by the booking form and the bookings API).
 *
 * Accepts 10-digit mobiles starting with 6–9, optionally prefixed with +91, 91 or 0,
 * with spaces, dashes or parentheses as separators: "98765 43210", "+91-98765-43210", "098765 43210".
 */
const SEPARATORS = /[\s().-]/g;
const INDIAN_MOBILE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

export const INDIAN_PHONE_ERROR = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';

/**
 * @param {string} value
 * @returns {string|null} normalized "+91 98765 43210", or null when invalid
 */
export function normalizeIndianPhone(value) {
  const compact = String(value || '').replace(SEPARATORS, '');
  const match = INDIAN_MOBILE.exec(compact);
  if (!match) return null;
  const digits = match[1];
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
