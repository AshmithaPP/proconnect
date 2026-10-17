import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateCustomerGoogleAuthUrl } from '@/features/google/google-auth.service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const state = 'customer_' + crypto.randomBytes(32).toString('hex');
    const authUrl = await generateCustomerGoogleAuthUrl(state);

    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    });

    cookieStore.set('google_oauth_flow', 'customer_signin', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[Customer Google Connect Error]:', err.message);
    const returnUrl = new URL('/?google_error=auth_unavailable#book', request.url);
    return NextResponse.redirect(returnUrl);
  }
}
