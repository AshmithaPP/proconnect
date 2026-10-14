import { NextResponse } from 'next/server';
import { verifyAdminApiSession } from '@/features/auth/api-guard';
import { listBookings, getBookingStats } from '@/features/booking/booking.repository';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * GET /api/admin/bookings?status=all|paid|pending|cancelled|no_payment&page=1&pageSize=20
 * Admin-only: every booking with its latest payment and derived `status`, plus KPI stats.
 * `status` defaults to "all".
 */
export async function GET(request) {
  const auth = await verifyAdminApiSession();
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;

  try {
    const [list, stats] = await Promise.all([
      listBookings({ status, page, pageSize }),
      getBookingStats(),
    ]);

    return NextResponse.json(
      { bookings: list.bookings, totalCount: list.totalCount, status: list.status, page, pageSize, stats },
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
