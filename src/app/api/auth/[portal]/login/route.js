import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { validateLoginInput } from '@/features/auth/auth.schema';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/security/rate-limit';
import { getPortal } from '@/features/auth/portals';
import {
  findPortalUserByEmail,
  updatePortalUserLastLogin,
  createPortalSession,
} from '@/features/auth/portal-user.repository';
import { verifyPassword } from '@/features/auth/password';
import { generateSessionToken, hashSessionToken } from '@/features/auth/session';
import { getSessionCookieName, getSessionCookieOptions } from '@/features/auth/cookie';

/** Resolves the [portal] segment; unknown portals 404. */
async function resolvePortal(params) {
  const { portal: portalKey } = await params;
  return getPortal(portalKey);
}

/**
 * POST /api/auth/{admin|consultant}/login
 * Signs in to ONE portal. An account of the other role gets the same generic error as a
 * wrong password, so the endpoint never reveals which emails exist in which portal.
 */
export async function POST(request, { params }) {
  const portal = await resolvePortal(params);
  if (!portal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  // 1. Verify Origin / Referer against Host to protect from CSRF
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json(
      { error: originCheck.error || 'Forbidden' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Client Identifier (Rate limiting disabled for now)
  /*
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimitKey = `${clientIp}:login:${portal.portalKey}`;

  // 3. Check Persistent Rate Limiting
  const rateStatus = await checkRateLimit(rateLimitKey, 'login');
  if (!rateStatus.allowed) {
    return NextResponse.json(
      {
        error: 'Too many failed login attempts. Please try again later.',
        retryAfterSeconds: rateStatus.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateStatus.retryAfterSeconds || 900),
          'Cache-Control': 'no-store',
        },
      }
    );
  }
  */

  // 4. Parse & Validate Payload
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const validation = validateLoginInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { email, password } = validation;

  try {
    // 5. Query Account Record
    const account = await findPortalUserByEmail(email);

    // Generic error to prevent account enumeration
    const genericAuthError = 'Invalid email or password';

    if (!account) {
      // await recordFailedAttempt(rateLimitKey, 'login');
      return NextResponse.json(
        { error: genericAuthError },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 6. Check Account Status and that the account belongs to THIS portal
    if (account.account_status !== 'active' || account.user_role !== portal.userRole) {
      // await recordFailedAttempt(rateLimitKey, 'login');
      return NextResponse.json(
        { error: genericAuthError },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 7. Verify Password Hash
    const passwordMatch = await verifyPassword(password, account.password_hash);
    if (!passwordMatch) {
      // await recordFailedAttempt(rateLimitKey, 'login');
      return NextResponse.json(
        { error: genericAuthError },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 8. Authentication Succeeded -> (Rate limit clear skipped while commented out)
    // await clearRateLimit(rateLimitKey, 'login');

    // 9. Generate Opaque 32-Byte Token & SHA-256 Hash
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    // 10. Persist Session in MySQL
    await createPortalSession({
      portalUserId: account.portal_user_id,
      sessionTokenHash: tokenHash,
    });

    // 11. Update Last Login Timestamp
    await updatePortalUserLastLogin(account.portal_user_id);

    // 12. Set Secure HttpOnly Cookie
    const cookieStore = await cookies();
    const cookieName = getSessionCookieName(portal.portalKey);
    const cookieOptions = getSessionCookieOptions();

    cookieStore.set(cookieName, rawToken, cookieOptions);

    // 13. Return Safe Profile
    return NextResponse.json(
      {
        success: true,
        user: {
          portalUserId: account.portal_user_id,
          fullName: account.full_name,
          email: account.email,
          userRole: account.user_role,
        },
        redirectTo: portal.homePath,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err) {
    console.error('Login processing error:', err.message);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
