import { NextResponse } from 'next/server';
import { PORTALS } from '@/features/auth/portals';
import { getSessionCookieName } from '@/features/auth/cookie';

/**
 * Optimistic portal gate for /admin/* and /consultant/*.
 *
 * Only checks that the portal's own session cookie is present, so logged-out visitors are
 * redirected to the right login page before any server rendering happens. It does NOT
 * validate the session or its role — PortalShell (requirePortalUser) and each portal API
 * route (verifyPortalApiSession) remain authoritative.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;
  const portal = Object.values(PORTALS).find(
    (p) => pathname === p.basePath || pathname.startsWith(`${p.basePath}/`)
  );

  if (!portal || pathname === portal.loginPath) {
    return NextResponse.next();
  }

  // "/admin" and "/consultant" have no page of their own
  if (pathname === portal.basePath) {
    return NextResponse.redirect(new URL(portal.homePath, request.url));
  }

  if (!request.cookies.has(getSessionCookieName(portal.portalKey))) {
    return NextResponse.redirect(new URL(portal.loginPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/consultant/:path*'],
};
