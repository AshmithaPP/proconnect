import { NextResponse } from 'next/server';
import { verifyAdminApiSession } from '@/lib/auth/api-guard';

export async function GET() {
  const auth = await verifyAdminApiSession();

  if (!auth.authorized) {
    return auth.response;
  }

  const { admin } = auth;

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        adminUserId: admin.adminUserId,
        fullName: admin.fullName,
        email: admin.email,
        accountStatus: admin.accountStatus,
        lastLoginAt: admin.lastLoginAt,
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
