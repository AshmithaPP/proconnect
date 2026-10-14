import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { validateLoginInput } from '@/features/auth/auth.schema';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/security/rate-limit';
import { findAdminByEmail, updateAdminLastLogin, createAdminSession } from '@/features/auth/admin-user.repository';
import { verifyPassword } from '@/features/auth/password';
import { generateSessionToken, hashSessionToken } from '@/features/auth/session';
import { getSessionCookieName, getSessionCookieOptions } from '@/features/auth/cookie';

export async function POST(request) {
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
  const rateLimitKey = `${clientIp}:login`;

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
    // 5. Query Administrator Record
    const admin = await findAdminByEmail(email);

    // Generic error to prevent account enumeration
    const genericAuthError = 'Invalid email or password';

    if (!admin) {
      // await recordFailedAttempt(rateLimitKey, 'login');
      return NextResponse.json(
        { error: genericAuthError },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 6. Check Account Status
    if (admin.account_status !== 'active') {
      // await recordFailedAttempt(rateLimitKey, 'login');
      return NextResponse.json(
        { error: genericAuthError },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 7. Verify Password Hash
    const passwordMatch = await verifyPassword(password, admin.password_hash);
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
    await createAdminSession({
      adminUserId: admin.admin_user_id,
      sessionTokenHash: tokenHash,
    });

    // 11. Update Last Login Timestamp
    await updateAdminLastLogin(admin.admin_user_id);

    // 12. Set Secure HttpOnly Cookie
    const cookieStore = await cookies();
    const cookieName = getSessionCookieName();
    const cookieOptions = getSessionCookieOptions();

    cookieStore.set(cookieName, rawToken, cookieOptions);

    // 13. Return Safe Profile
    return NextResponse.json(
      {
        success: true,
        user: {
          adminUserId: admin.admin_user_id,
          fullName: admin.full_name,
          email: admin.email,
        },
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
