import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionCookieName } from '@/features/auth/cookie';
import { hashSessionToken } from '@/features/auth/session';
import { findValidSession, touchSessionActivity } from '@/features/auth/admin-user.repository';
import { sanitizeReturnTo } from '@/features/auth/auth.schema';

/**
 * Check if the current request has a valid admin session without redirecting.
 * Used by public pages like /admin/login to skip login if already authenticated.
 * @returns {Promise<{ admin: any, session: any } | null>}
 */
export async function getAuthenticatedAdminOrNull() {
  try {
    const cookieStore = await cookies();
    const cookieName = getSessionCookieName();
    const sessionToken = cookieStore.get(cookieName)?.value;

    if (!sessionToken) {
      return null;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const valid = await findValidSession(tokenHash);

    if (!valid) {
      return null;
    }

    // Touch sliding window
    await touchSessionActivity(tokenHash);

    return valid;
  } catch (err) {
    console.error('Session verification error:', err.message);
    return null;
  }
}

/**
 * Server Component SSR Auth Guard
 * Verifies admin session directly against MySQL.
 * If unauthenticated or invalid, immediately redirects to /admin/login with safe returnTo.
 * 
 * @param {string} [currentPath] - Path to return to after authenticating
 * @returns {Promise<{ admin: any, session: any }>}
 */
export async function requireAdmin() {
  const auth = await getAuthenticatedAdminOrNull();

  if (!auth) {
    redirect('/admin/login');
  }

  return auth;
}
