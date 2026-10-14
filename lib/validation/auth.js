/**
 * Validate and normalize login request input
 * @param {any} body 
 * @returns {{ valid: boolean, email?: string, password?: string, error?: string }}
 */
export function validateLoginInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { email, password } = body;

  if (typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: 'Email is required' };
  }

  if (typeof password !== 'string' || !password) {
    return { valid: false, error: 'Password is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { valid: false, error: 'Invalid email address format' };
  }

  return {
    valid: true,
    email: normalizedEmail,
    password,
  };
}

/**
 * Validate and sanitize returnTo URL to strictly prevent Open Redirect attacks.
 * 
 * Rules:
 * - Must begin with a single '/'
 * - Must NOT begin with '//' or '/\' (protocol-relative / Windows path bypass)
 * - Must not contain control characters or external schemes
 * - Defaults safely to '/admin/dashboard'
 * 
 * @param {string | null | undefined} returnTo
 * @returns {string}
 */
export function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') {
    return '/admin/dashboard';
  }

  const trimmed = returnTo.trim();

  // Must begin with a single forward slash, but not double slash or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/admin/dashboard';
  }

  // Reject dangerous characters or protocol injections
  if (/[\r\n\t\0]/.test(trimmed)) {
    return '/admin/dashboard';
  }

  try {
    // Resolve against dummy origin to verify pathname and origin retention
    const parsed = new URL(trimmed, 'https://localhost');
    if (parsed.origin !== 'https://localhost') {
      return '/admin/dashboard';
    }

    return parsed.pathname + parsed.search;
  } catch {
    return '/admin/dashboard';
  }
}
