/**
 * Client-safe: no env access, usable from both server and client components.
 * Format an amount stored in paise as a currency string, e.g. 99900 → "₹999.00"
 * @param {number} amountPaise
 * @param {string} currencyCode
 */
export function formatAmount(amountPaise, currencyCode = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
  }).format((Number(amountPaise) || 0) / 100);
}
