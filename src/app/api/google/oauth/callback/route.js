import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { handleGoogleOAuthCallback } from '@/features/google/google-auth.service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const cookieStore = await cookies();
  const savedState = cookieStore.get('google_oauth_state')?.value;
  const flow = cookieStore.get('google_oauth_flow')?.value;
  const portal = cookieStore.get('google_oauth_portal')?.value;

  // Clear CSRF & flow cookies
  cookieStore.delete('google_oauth_state');
  cookieStore.delete('google_oauth_flow');
  cookieStore.delete('google_oauth_portal');

  // Derive baseUrl from the incoming request's actual host so it NEVER accidentally redirects to localhost in live deployments
  const host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '') || 'https');
  const requestOrigin = `${proto}://${host}`;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))
    ? process.env.NEXT_PUBLIC_APP_URL
    : requestOrigin;

  // Customer 1-Click Booking Sign-In Flow
  const isCustomerFlow = flow === 'customer_signin' || (state && state.startsWith('customer_'));

  if (isCustomerFlow) {
    const returnTarget = new URL('/#book', baseUrl);

    if (error) {
      returnTarget.searchParams.set('google_error', error);
      return NextResponse.redirect(returnTarget);
    }

    if (!code || !state || (savedState && state !== savedState)) {
      returnTarget.searchParams.set('google_error', 'invalid_state');
      return NextResponse.redirect(returnTarget);
    }

    try {
      const { handleCustomerGoogleOAuthCallback } = await import('@/features/google/google-auth.service');
      const profile = await handleCustomerGoogleOAuthCallback(code);

      // Save customer session cookie (valid for 3 days)
      cookieStore.set('customer_google_session', JSON.stringify(profile), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 3 * 24 * 60 * 60,
      });

      returnTarget.searchParams.set('google_auth', 'success');
      return NextResponse.redirect(returnTarget);
    } catch (err) {
      console.error('[Customer Google OAuth Error]:', err.message);
      returnTarget.searchParams.set('google_error', err.message);
      return NextResponse.redirect(returnTarget);
    }
  }

  // Portal (Super Admin / Admin) Calendar Integration Flow
  const resolvedPortal = (state && state.startsWith('portal_superadmin'))
    ? 'superadmin'
    : (portal || 'admin');

  const redirectPath = resolvedPortal === 'superadmin'
    ? '/superadmin/dashboard/google-meet'
    : '/admin/dashboard/google-meet';
  const targetRedirect = new URL(redirectPath, baseUrl);

  if (error) {
    targetRedirect.searchParams.set('error', error);
    return NextResponse.redirect(targetRedirect);
  }

  if (!code || !state || (savedState && state !== savedState)) {
    targetRedirect.searchParams.set('error', 'invalid_state');
    return NextResponse.redirect(targetRedirect);
  }

  try {
    await handleGoogleOAuthCallback(code);
    targetRedirect.searchParams.set('connected', 'true');
    return NextResponse.redirect(targetRedirect);
  } catch (err) {
    console.error('[Google OAuth Callback Error]:', err.message);
    targetRedirect.searchParams.set('error', err.message);
    return NextResponse.redirect(targetRedirect);
  }
}
