import { verifyPortalApiSession, verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import { validateBookingRules, validateWeeklyHours } from '@/features/schedule/schedule.definitions';
import {
  getBookingRules,
  saveBookingRules,
  listWeeklyHours,
  replaceWeeklyHours,
  getBusinessTimezone,
  loadAvailability,
} from '@/features/schedule/schedule.repository';

const PORTALS = ['consultant', 'admin'];

async function readSchedule() {
  const [rules, weeklyHours, timezone] = await Promise.all([getBookingRules(), listWeeklyHours(), getBusinessTimezone()]);
  return { rules, weeklyHours, timezone };
}

/**
 * GET /api/consultant/schedule — booking rules (fee, window, notice, slot length, gap) + weekly hours
 * PUT /api/consultant/schedule — body { rules?, weeklyHours? }; fee is sent as rules.consultationFeeRupees
 * Consultant or platform admin.
 *
 * PUT also reports `bookingsOutsideHours`: upcoming paid bookings that no longer fit the new
 * hours/slot length. They are kept (never cancelled) and still shown in the calendar.
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
  if (!body || (body.rules === undefined && body.weeklyHours === undefined)) {
    return jsonNoStore({ error: 'Nothing to save' }, 400);
  }

  let rules = null;
  if (body.rules !== undefined) {
    const result = validateBookingRules(body.rules);
    if (Object.keys(result.fieldErrors).length) {
      return jsonNoStore({ error: 'Please fix the highlighted fields', fieldErrors: result.fieldErrors }, 400);
    }
    rules = result.value;
  }

  let weeklyHours = null;
  if (body.weeklyHours !== undefined) {
    const result = validateWeeklyHours(body.weeklyHours);
    if (result.error) return jsonNoStore({ error: result.error, fieldErrors: { weeklyHours: result.error } }, 400);
    weeklyHours = result.value;
  }

  try {
    if (rules) await saveBookingRules(rules, auth.user.portalUserId);
    if (weeklyHours) await replaceWeeklyHours(weeklyHours);

    const { days } = await loadAvailability({ days: 60 });
    const bookingsOutsideHours = days.flatMap((d) => d.slots).filter((s) => s.outsideHours).length;

    return jsonNoStore({ success: true, ...(await readSchedule()), bookingsOutsideHours });
  } catch (err) {
    console.error('Schedule save error:', err.message);
    return jsonNoStore({ error: 'Could not save the schedule' }, 500);
  }
}
