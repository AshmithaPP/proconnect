import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { listBookingsForView, getBookingViewCounts, BOOKING_VIEW_KEYS } from '@/features/booking/booking.repository';
import { getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { getZonedNow } from '@/features/schedule/slot-engine';

/**
 * GET /api/consultant/bookings?view=upcoming|today|past|reschedule&page=1&pageSize=20&q=search
 * Consultant or platform admin: paid bookings by consultation date (business timezone),
 * plus the count for each view.
 */
export async function GET(request) {
  // Shared feature: the platform admin can see everything the consultant can
  const auth = await verifyPortalApiSession(['consultant', 'admin']);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const view = BOOKING_VIEW_KEYS.includes(searchParams.get('view')) ? searchParams.get('view') : 'upcoming';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 20;
  const search = searchParams.get('q') || '';

  try {
    const today = getZonedNow(await getBusinessTimezone()).date;
    const [list, counts] = await Promise.all([
      listBookingsForView({ view, today, page, pageSize, search }),
      getBookingViewCounts(today),
    ]);
    return jsonNoStore({ view, today, page, pageSize, bookings: list.bookings, totalCount: list.totalCount, counts });
  } catch (err) {
    console.error('Consultant bookings list error:', err.message);
    return jsonNoStore({ error: 'Could not load bookings' }, 500);
  }
}
