import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { listBookingsForView, getBookingViewCounts, BOOKING_VIEW_KEYS } from '@/features/booking/booking.repository';
import { getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { getZonedNow } from '@/features/schedule/slot-engine';
import { getRescheduleSummaries } from '@/features/reschedule/reschedule.repository';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/bookings?view=upcoming|today|past|reschedule&page=1&pageSize=20&q=search
 * Returns paid bookings for the requested view, counts per view, reschedule summaries, pagination, and business timezone.
 */
export async function GET(request) {
  const auth = await verifyPortalApiSession(['admin', 'superadmin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedView = searchParams.get('view');
  const view = BOOKING_VIEW_KEYS.includes(requestedView) ? requestedView : 'upcoming';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize')) || 20, 1), 100);
  const search = searchParams.get('q') || '';

  try {
    // Retry pending reschedules so views are always fresh
    await retryPendingReschedules();
    const timezone = await getBusinessTimezone();
    const today = getZonedNow(timezone).date;

    const [list, counts] = await Promise.all([
      listBookingsForView({ view, today, page, pageSize, search }),
      getBookingViewCounts(today),
    ]);

    const movesMap = await getRescheduleSummaries(list.bookings.map((b) => b.bookingId));
    const moves = Object.fromEntries(movesMap);

    return jsonNoStore({
      success: true,
      view,
      today,
      timezone,
      page,
      pageSize,
      totalCount: list.totalCount,
      totalPages: Math.max(Math.ceil(list.totalCount / pageSize), 1),
      counts,
      bookings: list.bookings,
      moves,
    });
  } catch (err) {
    console.error('[Admin Bookings API] Error:', err.message);
    return jsonNoStore({ error: 'Could not load bookings data' }, 500);
  }
}
