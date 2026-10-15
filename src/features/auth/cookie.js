/**
 * Centralized Session Cookie Configuration
 *
 * One cookie per portal (see portals.js): "admin_session" / "consultant_session".
 * Rules:
 * - Production: uses prefix `__Host-` which mandates Secure=true, Path=/, and no Domain attribute.
 * - Development: plain name to work reliably over localhost HTTP.
 */
import { getPortal } from '@/features/auth/portals';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * @param {string} portalKey - "admin" | "consultant"
 */
export function getSessionCookieName(portalKey) {
  const portal = getPortal(portalKey);
  if (!portal) throw new Error(`Unknown portal "${portalKey}"`);
  return IS_PROD ? `__Host-${portal.cookieBaseName}` : portal.cookieBaseName;
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
