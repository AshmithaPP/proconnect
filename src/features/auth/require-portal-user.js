import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortal } from '@/features/auth/portals';
import { getSessionCookieName } from '@/features/auth/cookie';
import { hashSessionToken } from '@/features/auth/session';
import { findValidSession, touchSessionActivity } from '@/features/auth/portal-user.repository';

/**
 * Check if the current request has a valid session for a portal without redirecting.
 * Used by login pages to skip the form when already signed in.
 * @param {'admin' | 'consultant'} portalKey
 * @returns {Promise<{ user: any, session: any } | null>}
 */
export async function getPortalUserOrNull(portalKey) {
  const portal = getPortal(portalKey);
  if (!portal) throw new Error(`Unknown portal "${portalKey}"`);

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getSessionCookieName(portalKey))?.value;

    if (!sessionToken) {
      return null;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const valid = await findValidSession(tokenHash, portal.userRole);

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
 * Verifies the portal session (and its role) directly against MySQL.
 * If unauthenticated or invalid, immediately redirects to that portal's login page.
 *
 * @param {'admin' | 'consultant'} portalKey
 * @returns {Promise<{ user: any, session: any }>}
 */
export async function requirePortalUser(portalKey) {
  const auth = await getPortalUserOrNull(portalKey);

  if (!auth) {
    redirect(getPortal(portalKey).loginPath);
  }

  return auth;
}
