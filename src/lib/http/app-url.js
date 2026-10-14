/**
 * Absolute base URL of this app, used for gateway return URLs and redirects.
 *
 * - Production: NEXT_PUBLIC_APP_URL (canonical public domain) when set, so a spoofed
 *   Host header can never redirect customers or the payment gateway elsewhere.
 * - Development: the origin the request actually arrived on, so it works on any
 *   port (3000, 3001, …) without editing .env.local.
 *
 * @param {import('next/server').NextRequest} request
 * @returns {string} e.g. "http://localhost:3001" (no trailing slash)
 */
export function getAppBaseUrl(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'production' && configured) {
    return configured.replace(/\/+$/, '');
  }
  return request.nextUrl.origin;
}
