import { NextResponse } from 'next/server';
import { verifyPortalApiSession } from '@/features/auth/api-guard';
import { listPaidBookings, getPaidBookingStats } from '@/features/booking/booking.repository';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/consultant/bookings?page=1&pageSize=20
 * Consultant or platform admin: successfully paid & confirmed bookings (most recently paid first), plus KPI stats.
 */
export async function GET(request) {
  // Shared feature: the platform admin can see everything the consultant can
  const auth = await verifyPortalApiSession(['consultant', 'admin']);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;

  try {
    const [list, stats] = await Promise.all([
      listPaidBookings({ page, pageSize }),
      getPaidBookingStats(),
    ]);

    return NextResponse.json(
      { bookings: list.bookings, totalCount: list.totalCount, page, pageSize, stats },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error('Consultant bookings list error:', err.message);
    return NextResponse.json(
      { error: 'Could not load bookings' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
