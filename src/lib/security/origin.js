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
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (!host) {
    return { valid: false, error: 'Missing Host header' };
  }

  // If origin header is present, ensure it matches current host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return { valid: false, error: 'Cross-origin request forbidden' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Malformed Origin header' };
    }
  }

  // Fallback to Referer header if Origin is absent
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return { valid: false, error: 'Cross-origin referer forbidden' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Malformed Referer header' };
    }
  }

  // For modern browsers on same-origin POST requests, origin or referer is typically present.
  // In development/curl, we allow if host is verified.
  return { valid: true };
}
