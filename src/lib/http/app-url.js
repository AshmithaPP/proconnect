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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Base URL to hand to a payment gateway as the customer return URL.
 *
 * Worldline's firewall rejects any request whose body contains "localhost" / "127.0.0.1"
 * (HTML 403 from the load balancer). In development we therefore swap a loopback host for
 * "localtest.me" — a public DNS name that resolves back to this machine — so the customer
 * still lands on the local dev server. Set PAYMENT_RETURN_BASE_URL (e.g. an ngrok URL) to
 * override. Production always uses getAppBaseUrl() (NEXT_PUBLIC_APP_URL).
 *
 * @param {import('next/server').NextRequest} request
 * @returns {string}
 */
export function getPaymentReturnBaseUrl(request) {
  const override = process.env.PAYMENT_RETURN_BASE_URL;
  if (override) return override.replace(/\/+$/, '');

  const base = new URL(getAppBaseUrl(request));
  if (process.env.NODE_ENV !== 'production' && LOOPBACK_HOSTS.has(base.hostname)) {
    base.hostname = 'localtest.me';
  }
  return base.origin;
}
