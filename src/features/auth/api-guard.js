import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPortal } from '@/features/auth/portals';
import { getSessionCookieName } from '@/features/auth/cookie';
import { hashSessionToken } from '@/features/auth/session';
import { findValidSession, touchSessionActivity } from '@/features/auth/portal-user.repository';
import { verifyRequestOrigin } from '@/lib/security/origin';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * Independent API authorization guard for Route Handlers
 *
 * Verifies that:
 * 1. A session cookie of one of the allowed portals is present
 * 2. Its token hash matches an active, unrevoked, unexpired session in MySQL
 * 3. The account is active AND has that portal's role
 *
 * Features shared by both portals (e.g. bookings) pass ['consultant', 'admin'] — the platform
 * admin can do everything the consultant can. Admin-only features pass 'admin'.
 *
 * Returns standard 401 response with no-store caching headers on failure.
 *
 * @param {'admin' | 'consultant' | Array<'admin' | 'consultant'>} portalKeys
 * @returns {Promise<{ authorized: boolean, portalKey?: string, user?: any, session?: any,
 *   sessionTokenHash?: string, response?: NextResponse }>}
 */
export async function verifyPortalApiSession(portalKeys) {
  const allowed = Array.isArray(portalKeys) ? portalKeys : [portalKeys];
  const cookieStore = await cookies();
  let sawCookie = false;

  try {
    for (const portalKey of allowed) {
      const portal = getPortal(portalKey);
      if (!portal) throw new Error(`Unknown portal "${portalKey}"`);

      const sessionToken = cookieStore.get(getSessionCookieName(portal.portalKey))?.value;
      if (!sessionToken) continue;
      sawCookie = true;

      const tokenHash = hashSessionToken(sessionToken);
      const valid = await findValidSession(tokenHash, portal.userRole);
      if (!valid) continue;

      // Touch sliding window activity
      await touchSessionActivity(tokenHash);

      return { authorized: true, portalKey: portal.portalKey, user: valid.user, session: valid.session, sessionTokenHash: tokenHash };
    }
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

  return {
    authorized: false,
    response: NextResponse.json(
      { error: sawCookie ? 'Unauthorized: Session invalid or expired' : 'Unauthorized: Session missing' },
      { status: 401, headers: NO_STORE }
    ),
  };
}

/**
 * verifyPortalApiSession + CSRF origin check for state-changing requests (POST/PUT/PATCH/DELETE).
 * @param {Request} request
 * @param {'admin' | 'consultant' | Array<'admin' | 'consultant'>} portalKeys
 */
export async function verifyPortalApiRequest(request, portalKeys) {
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return {
      authorized: false,
      response: NextResponse.json({ error: originCheck.error || 'Forbidden' }, { status: 403, headers: NO_STORE }),
    };
  }
  return verifyPortalApiSession(portalKeys);
}

/** JSON response that is never cached */
export function jsonNoStore(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Parse a JSON body; null when malformed */
export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
