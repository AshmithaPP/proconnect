import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import {
  addTimeOff,
  removeTimeOffForDate,
  listConfirmedBookingSlots,
  getBusinessTimezone,
} from '@/features/schedule/schedule.repository';
import { getZonedNow, timeToMinutes, formatSlotLabel } from '@/features/schedule/slot-engine';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * POST /api/consultant/time-off — mark the consultant NOT available (consultant or admin)
 * Body: { offDate, startTime?, endTime?, timeOffReason? }
 *   - no startTime → the whole day
 *   - startTime + endTime → that time range (one or more slots)
 *
 * Confirmed bookings cannot be switched off or moved. Only unbooked slots/days can be blocked.
 * The only automatic switching allowed in the system is during checkout concurrency (slot_taken).
 */
export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, ['superadmin', 'admin', 'consultant']);
  if (!auth.authorized) return auth.response;

  const body = await readJsonBody(request);
  if (!body) return jsonNoStore({ error: 'Malformed JSON payload' }, 400);

  const offDate = String(body.offDate || '');
  const startTime = body.startTime ? String(body.startTime) : null;
  const endTime = body.endTime ? String(body.endTime) : null;
  const timeOffReason = typeof body.timeOffReason === 'string' ? body.timeOffReason.trim().slice(0, 200) || null : null;

  if (!DATE_REGEX.test(offDate)) return jsonNoStore({ error: 'Invalid date' }, 400);
  const today = getZonedNow(await getBusinessTimezone()).date;
  if (offDate < today) return jsonNoStore({ error: 'Past dates cannot be changed' }, 400);
  if ((startTime || endTime) && (!TIME_REGEX.test(startTime || '') || !TIME_REGEX.test(endTime || '') || endTime <= startTime)) {
    return jsonNoStore({ error: 'Invalid time range' }, 400);
  }

  try {
    const bookings = await listConfirmedBookingSlots(offDate, offDate);
    const clashes = startTime
      ? bookings.filter(
          (b) => timeToMinutes(b.slotStartTime) < timeToMinutes(endTime) && timeToMinutes(startTime) < timeToMinutes(b.slotEndTime)
        )
      : bookings;

    // Disallow switching or moving of confirmed bookings
    if (clashes.length > 0) {
      const list = clashes.map((b) => `${formatSlotLabel(b.slotStartTime, b.slotEndTime)} — ${b.fullName}`).join('; ');
      const what = clashes.length === 1 ? 'is a confirmed paid booking' : `are ${clashes.length} confirmed paid bookings`;
      return jsonNoStore(
        {
          error: `Cannot mark unavailable: there ${what} at this time (${list}). Successfully booked consultations cannot be switched or moved.`,
        },
        400
      );
    }

    // A whole-day block replaces any single-slot blocks on that date
    if (!startTime) await removeTimeOffForDate(offDate);
    const timeOffId = await addTimeOff({ offDate, startTime, endTime, timeOffReason, createdByUserId: auth.user.portalUserId });

    return jsonNoStore({ success: true, timeOffId }, 201);
  } catch (err) {
    console.error('Time off create error:', err.message);
    return jsonNoStore({ error: 'Could not save' }, 500);
  }
}
