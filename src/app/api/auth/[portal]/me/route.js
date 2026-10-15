import { NextResponse } from 'next/server';
import { getPortal } from '@/features/auth/portals';
import { verifyPortalApiSession } from '@/features/auth/api-guard';

/** GET /api/auth/{admin|consultant}/me — the signed-in account of this portal. */
export async function GET(request, { params }) {
  const { portal: portalKey } = await params;
  if (!getPortal(portalKey)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const auth = await verifyPortalApiSession(portalKey);

  if (!auth.authorized) {
    return auth.response;
  }

  const { user } = auth;

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        portalUserId: user.portalUserId,
        fullName: user.fullName,
        email: user.email,
        userRole: user.userRole,
        accountStatus: user.accountStatus,
        lastLoginAt: user.lastLoginAt,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
