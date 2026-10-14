import { NextResponse } from 'next/server';
import { getSessionCookieName } from '@/features/auth/cookie';

/**
 * Optimistic admin gate.
 *
 * Only checks that a session cookie is present, so logged-out visitors are
 * redirected before any server rendering happens. It does NOT validate the
 * session — the database check in admin/(protected)/layout.jsx (requireAdmin)
 * and in each admin API route (verifyAdminApiSession) remains authoritative.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  if (!request.cookies.has(getSessionCookieName())) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
