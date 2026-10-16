import { verifyPortalApiSession, jsonNoStore } from '@/features/auth/api-guard';
import { loadAvailability, getBusinessTimezone } from '@/features/schedule/schedule.repository';
import { getZonedNow } from '@/features/schedule/slot-engine';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/consultant/availability?from=YYYY-MM-DD&days=14 — consultant or platform admin
 * The full calendar incl. who booked each slot and time-off ids (for blocking/unblocking).
 * Defaults: from today, the customer booking window. Max 60 days.
 */
export async function GET(request) {
  const auth = await verifyPortalApiSession(['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 0, 0), 60);

  try {
    const today = getZonedNow(await getBusinessTimezone()).date;
    const fromDate = from && DATE_REGEX.test(from) && from >= today ? from : today;
    const availability = await loadAvailability({ fromDate, days: days || undefined });
    return jsonNoStore({ today, ...availability });
  } catch (err) {
    console.error('Consultant availability error:', err.message);
    return jsonNoStore({ error: 'Could not load availability' }, 500);
  }
}
