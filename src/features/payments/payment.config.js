import 'server-only';

/**
 * Payment configuration (server-only: reads gateway secrets from env).
 *
 * PAYMENT_MODE:
 *  - "worldline" → Worldline Connect Hosted Checkout (pre-production or live, per WORLDLINE_BASE_URL).
 *  - "disabled"  → bookings are stored as pending_payment and nothing marks them paid.
 */

export function getPaymentMode() {
  const mode = (process.env.PAYMENT_MODE || 'disabled').toLowerCase();
  return mode === 'worldline' ? 'worldline' : 'disabled';
}

export function getWorldlineConfig() {
  return {
    baseUrl: process.env.WORLDLINE_BASE_URL || 'https://api.preprod.connect.worldline-solutions.com',
    merchantId: process.env.WORLDLINE_MERCHANT_ID || '9000000514',
    apiKeyId: process.env.WORLDLINE_API_KEY_ID || '',
    secretApiKey: process.env.WORLDLINE_SECRET_API_KEY || '',
  };
}

export function getConsultationFee() {
  const amountPaise = Number(process.env.CONSULTATION_FEE_PAISE);
  return {
    amountPaise: Number.isInteger(amountPaise) && amountPaise > 0 ? amountPaise : 0,
    currencyCode: 'INR',
  };
}
