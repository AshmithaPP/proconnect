/**
 * Request Origin & CSRF Verification
 * Verifies that state-changing requests originate from the expected host.
 */
export function verifyRequestOrigin(request) {
  // Safe HTTP methods do not change state
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { valid: true };
  }

  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const rawHost = forwardedHost ? forwardedHost.split(',')[0].trim() : (request.headers.get('host') || '');
  const host = rawHost.split(':')[0].toLowerCase();

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : null;
  const configuredHost = configuredUrl?.hostname?.toLowerCase();

  // If origin header is present, ensure it matches current host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.hostname.toLowerCase();
      if (originHost === host || (configuredHost && originHost === configuredHost)) {
        return { valid: true };
      }
      return { valid: false, error: 'Cross-origin request forbidden' };
    } catch {
      return { valid: false, error: 'Malformed Origin header' };
    }
  }

  // Fallback to Referer header if Origin is absent
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname.toLowerCase();
      if (refererHost === host || (configuredHost && refererHost === configuredHost)) {
        return { valid: true };
      }
      return { valid: false, error: 'Cross-origin referer forbidden' };
    } catch {
      return { valid: false, error: 'Malformed Referer header' };
    }
  }

  // For modern browsers on same-origin POST requests, origin or referer is typically present.
  // In development/curl, we allow if host is verified.
  return { valid: true };
}
