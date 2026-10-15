import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { getSessionCookieName, getClearSessionCookieOptions } from '@/features/auth/cookie';
import { hashSessionToken } from '@/features/auth/session';
import { revokeSession } from '@/features/auth/portal-user.repository';
import { getPortal } from '@/features/auth/portals';

/** Resolves the [portal] segment; unknown portals 404. */
async function resolvePortal(params) {
  const { portal: portalKey } = await params;
  return getPortal(portalKey);
}

/** POST /api/auth/{admin|consultant}/logout — ends only this portal's session. */
export async function POST(request, { params }) {
  const portal = await resolvePortal(params);
  if (!portal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  // 1. Verify Origin / Referer
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json(
      { error: originCheck.error || 'Forbidden' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const cookieStore = await cookies();
    const cookieName = getSessionCookieName(portal.portalKey);
    const sessionToken = cookieStore.get(cookieName)?.value;

    // 2. Invalidate server-side session in MySQL if token exists
    if (sessionToken) {
      try {
        const tokenHash = hashSessionToken(sessionToken);
        await revokeSession(tokenHash);
      } catch (err) {
        console.error('Session revocation error:', err.message);
      }
    }

    // 3. Clear browser cookie with identical name and path
    const clearOptions = getClearSessionCookieOptions();
    cookieStore.set(cookieName, '', clearOptions);

    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err) {
    console.error('Logout error:', err.message);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
