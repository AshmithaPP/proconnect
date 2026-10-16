import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyPortalApiSession } from '@/features/auth/api-guard';
import { generateGoogleAuthUrl } from '@/features/google/google-auth.service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await verifyPortalApiSession(['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const url = new URL(request.url);
  const portalParam = url.searchParams.get('portal');
  const portal = portalParam === 'superadmin' || auth.portalKey === 'superadmin' ? 'superadmin' : 'admin';

  try {
    const state = crypto.randomBytes(32).toString('hex');
    const authUrl = await generateGoogleAuthUrl(state);

    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/google/oauth/callback',
      maxAge: 10 * 60, // 10 minutes
    });

    cookieStore.set('google_oauth_portal', portal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/google/oauth/callback',
      maxAge: 10 * 60,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[Google Connect Error]:', err.message);
    const fallbackPath = portal === 'superadmin' ? '/superadmin/dashboard/google-meet' : '/admin/dashboard/google-meet';
    return NextResponse.redirect(new URL(`${fallbackPath}?error=config_error`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
