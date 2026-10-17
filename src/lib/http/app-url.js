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
  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/+$/, '');
  }
  const forwardedHost = request?.headers?.get('x-forwarded-host');
  const rawHost = forwardedHost ? forwardedHost.split(',')[0].trim() : (request?.headers?.get('host') || '');
  const proto = request?.headers?.get('x-forwarded-proto')?.split(',')[0]?.trim() || (request?.nextUrl?.protocol?.replace(':', '') || 'https');
  if (rawHost) {
    return `${proto}://${rawHost}`;
  }
  return request?.nextUrl?.origin || 'http://localhost:3000';
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Base URL to hand to a payment gateway as the customer return URL.
 *
 * Worldline's firewall rejects any request whose body contains "localhost" / "127.0.0.1"
 * (HTML 403 from the load balancer). In development we therefore swap a loopback host for
 * "localtest.me" — a public DNS name that resolves back to this machine.
 *
 * @param {import('next/server').NextRequest} request
 * @returns {string}
 */
export function getPaymentReturnBaseUrl(request) {
  const override = process.env.PAYMENT_RETURN_BASE_URL;
  if (override) return override.replace(/\/+$/, '');

  const appBase = getAppBaseUrl(request);
  const base = new URL(appBase);
  if (LOOPBACK_HOSTS.has(base.hostname)) {
    if (process.env.NODE_ENV !== 'production') {
      base.hostname = 'localtest.me';
    } else {
      return 'https://proconnect-black.vercel.app';
    }
  }
  return base.origin;
}
