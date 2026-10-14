import 'server-only';

/**
 * Payment configuration (server-only: reads gateway secrets from env).
 *
 * PAYMENT_MODE:
 *  - "worldline" → Live/Pre-production Worldline Connect Hosted Checkout integration.
 *  - "mock"      → Internal mock payment for instant local confirmation without gateway.
 *  - "disabled"  → bookings are stored as pending_payment and nothing marks them paid.
 */

export function getPaymentMode() {
  const mode = (process.env.PAYMENT_MODE || 'disabled').toLowerCase();
  if (mode === 'worldline') return 'worldline';
  if (mode === 'mock') return 'mock';
  return 'disabled';
}

export function getWorldlineConfig() {
  return {
    baseUrl: process.env.WORLDLINE_BASE_URL || 'https://api.preprod.connect.worldline-solutions.com',
    merchantId: process.env.WORLDLINE_MERCHANT_ID || '9000000514',
    apiKeyId: process.env.WORLDLINE_API_KEY_ID || '',
    secretApiKey: process.env.WORLDLINE_SECRET_API_KEY || '',
    env: process.env.WORLDLINE_ENV || 'preprod',
  };
}

/**
 * True only when WORLDLINE_ENV=mock. This is the ONLY switch that enables the
 * in-app checkout simulator and trust in MOCK_WL_ session IDs.
 */
export function isMockGatewayEnabled() {
  return getWorldlineConfig().env === 'mock';
}

export function getConsultationFee() {
  const amountPaise = Number(process.env.CONSULTATION_FEE_PAISE);
  return {
    amountPaise: Number.isInteger(amountPaise) && amountPaise > 0 ? amountPaise : 0,
    currencyCode: 'INR',
  };
}
