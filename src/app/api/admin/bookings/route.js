import { NextResponse } from 'next/server';
import { verifyAdminApiSession } from '@/features/auth/api-guard';
import { listPaidBookings, getBookingStats } from '@/features/booking/booking.repository';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/admin/bookings?page=1&pageSize=20
 * Admin-only: paid (confirmed) bookings, most recently paid first, plus KPI stats.
 */
export async function GET(request) {
  const auth = await verifyAdminApiSession();
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;

  try {
    const [{ bookings, totalCount }, stats] = await Promise.all([
      listPaidBookings({ page, pageSize }),
      getBookingStats(),
    ]);

    return NextResponse.json(
      { bookings, totalCount, page, pageSize, stats },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error('Admin bookings list error:', err.message);
    return NextResponse.json(
      { error: 'Could not load bookings' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
