import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPortal } from '@/features/auth/portals';
import { getSessionCookieName } from '@/features/auth/cookie';
import { hashSessionToken } from '@/features/auth/session';
import { findValidSession, touchSessionActivity } from '@/features/auth/portal-user.repository';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * Independent API authorization guard for Route Handlers
 *
 * Verifies that:
 * 1. The portal's session cookie is present
 * 2. Session token hash matches an active, unrevoked, unexpired session in MySQL
 * 3. The account is active AND has the portal's role
 *
 * Returns standard 401 response with no-store caching headers on failure.
 *
 * @param {'admin' | 'consultant'} portalKey
 * @returns {Promise<{ authorized: boolean, user?: any, session?: any, response?: NextResponse }>}
 */
export async function verifyPortalApiSession(portalKey) {
  const portal = getPortal(portalKey);
  if (!portal) throw new Error(`Unknown portal "${portalKey}"`);

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(getSessionCookieName(portalKey))?.value;

  if (!sessionToken) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401, headers: NO_STORE }),
    };
  }

  try {
    const tokenHash = hashSessionToken(sessionToken);
    const valid = await findValidSession(tokenHash, portal.userRole);

    if (!valid) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized: Session invalid or expired' },
          { status: 401, headers: NO_STORE }
        ),
      };
    }

    // Touch sliding window activity
    await touchSessionActivity(tokenHash);

    return {
      authorized: true,
      user: valid.user,
      session: valid.session,
    };
  } catch (err) {
    console.error('API session guard error:', err.message);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Internal authorization error' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }
}
