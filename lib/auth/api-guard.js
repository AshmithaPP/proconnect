import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionCookieName } from '@/lib/auth/cookie';
import { hashSessionToken } from '@/lib/auth/session';
import { findValidSession, touchSessionActivity } from '@/lib/data-access/admin-users';

/**
 * Independent API authorization guard for Route Handlers
 * 
 * Verifies that:
 * 1. Session cookie is present
 * 2. Session token hash matches an active, unrevoked, unexpired session in MySQL
 * 3. Administrator account exists and is active
 * 
 * Returns standard 401 response with no-store caching headers on failure.
 * 
 * @returns {Promise<{ authorized: boolean, admin?: any, session?: any, response?: NextResponse }>}
 */
export async function verifyAdminApiSession() {
  const cookieStore = await cookies();
  const cookieName = getSessionCookieName();
  const sessionToken = cookieStore.get(cookieName)?.value;

  if (!sessionToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Session missing' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        }
      ),
    };
  }

  try {
    const tokenHash = hashSessionToken(sessionToken);
    const valid = await findValidSession(tokenHash);

    if (!valid) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Unauthorized: Session invalid or expired' },
          {
            status: 401,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
          }
        ),
      };
    }

    // Touch sliding window activity
    await touchSessionActivity(tokenHash);

    return {
      authorized: true,
      admin: valid.admin,
      session: valid.session,
    };
  } catch (err) {
    console.error('API session guard error:', err.message);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Internal authorization error' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store' },
        }
      ),
    };
  }
}
