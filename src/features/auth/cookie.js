/**
 * Centralized Session Cookie Configuration
 * 
 * Rules:
 * - Production: uses prefix `__Host-admin_session` which mandates Secure=true, Path=/, and no Domain attribute.
 * - Development: uses `admin_session` to work reliably over localhost HTTP.
 */

const IS_PROD = process.env.NODE_ENV === 'production';
const BASE_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'admin_session';

export function getSessionCookieName() {
  return IS_PROD ? `__Host-${BASE_COOKIE_NAME}` : BASE_COOKIE_NAME;
}

/**
 * Return cookie attributes for an active session
 * @param {number} maxAgeInSeconds - Lifetime in seconds (defaults to 7 days)
 */
export function getSessionCookieOptions(maxAgeInSeconds = 7 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeInSeconds,
  };
}

/**
 * Return cookie attributes to clear/invalidate the cookie
 */
export function getClearSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}
