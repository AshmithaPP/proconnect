import { verifyPortalApiSession, verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateBookingRules } from '@/features/schedule/schedule.definitions';
import { getBookingRules, saveBookingRules, getBusinessTimezone, loadAvailability } from '@/features/schedule/schedule.repository';
import { BUSINESS_HOURS } from '@/features/schedule/slot-engine';
import { retryPendingReschedules } from '@/features/reschedule/reschedule.service';

const PORTALS = ['consultant', 'admin'];

async function readSchedule() {
  const [rules, timezone] = await Promise.all([getBookingRules(), getBusinessTimezone()]);
  return { rules, businessHours: BUSINESS_HOURS, timezone };
}

/**
 * GET /api/consultant/schedule — booking rules (fee, booking window, slot length, reschedule
 * limits) + the fixed business hours
 * PUT /api/consultant/schedule — body { rules }; fee is sent as rules.consultationFeeRupees
 * Consultant or platform admin.
 *
 * PUT also reports `bookingsOutsideHours`: upcoming paid bookings that no longer line up with
 * the new slot length. They are kept (never cancelled) and still shown in the calendar.
 */
export async function GET() {
  const auth = await verifyPortalApiSession(PORTALS);
  if (!auth.authorized) return auth.response;

  try {
    return jsonNoStore(await readSchedule());
  } catch (err) {
    console.error('Schedule read error:', err.message);
    return jsonNoStore({ error: 'Could not load the schedule' }, 500);
  }
}

export async function PUT(request) {
  const auth = await verifyPortalApiRequest(request, PORTALS);
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body || body.rules === undefined) return jsonNoStore({ error: 'Nothing to save' }, 400);

  const { value: rules, fieldErrors } = validateBookingRules(body.rules);
  if (Object.keys(fieldErrors).length) {
    return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors }, 400);
  }

  try {
    await saveBookingRules(rules, auth.user.portalUserId);
    // A different slot length can open slots for bookings waiting for a new time
    const { moved: rescheduledWaitingBookings } = await retryPendingReschedules();

    const { days } = await loadAvailability({ days: 60 });
    const bookingsOutsideHours = days.flatMap((d) => d.slots).filter((s) => s.outsideHours).length;

    return jsonNoStore({ success: true, ...(await readSchedule()), bookingsOutsideHours, rescheduledWaitingBookings });
  } catch (err) {
    console.error('Schedule save error:', err.message);
    return jsonNoStore({ error: 'Could not save the schedule' }, 500);
  }
}
