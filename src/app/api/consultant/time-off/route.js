import { verifyPortalApiRequest, jsonNoStore, readJsonBody } from '@/features/auth/api-guard';
import {
  addTimeOff,
  removeTimeOffForDate,
  listConfirmedBookingSlots,
  getBusinessTimezone,
} from '@/features/schedule/schedule.repository';
import { getZonedNow, timeToMinutes, formatSlotLabel, formatDateLabel } from '@/features/schedule/slot-engine';
import { autoRescheduleBooking } from '@/features/reschedule/reschedule.service';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * POST /api/consultant/time-off — mark the consultant NOT available (consultant or admin)
 * Body: { offDate, startTime?, endTime?, timeOffReason?, confirmMove? }
 *   - no startTime → the whole day
 *   - startTime + endTime → that time range (one or more slots)
 * Paid bookings inside the range are never dropped: without confirmMove the API answers 409
 * listing them (so the UI can ask "move them?"); with confirmMove: true the time off is saved
 * and each booking is moved automatically to the next free slot, and its customer emailed.
 */
export async function POST(request) {
  const auth = await verifyPortalApiRequest(request, ['consultant', 'admin']);
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
    if (clashes.length && body.confirmMove !== true) {
      const list = clashes.map((b) => `${formatSlotLabel(b.slotStartTime, b.slotEndTime)} — ${b.fullName}`).join('; ');
      const what = clashes.length === 1 ? 'is a paid booking' : `are ${clashes.length} paid bookings`;
      return jsonNoStore(
        {
          error: `There ${what} at this time (${list}). ${clashes.length === 1 ? 'It' : 'They'} will be moved automatically to the next free slot and the client emailed.`,
          clashingBookings: clashes.map((b) => ({ bookingId: b.bookingId, fullName: b.fullName })),
          canAutoMove: true,
        },
        409
      );
    }

    // A whole-day block replaces any single-slot blocks on that date
    if (!startTime) await removeTimeOffForDate(offDate);
    const timeOffId = await addTimeOff({ offDate, startTime, endTime, timeOffReason, createdByUserId: auth.user.portalUserId });

    // Move the paid bookings that were in this time, one by one (each to the next free slot)
    const movedBookings = [];
    for (const clash of clashes) {
      const result = await autoRescheduleBooking(clash.bookingId, {
        reason: 'consultant_unavailable',
        rescheduledBy: 'consultant',
        rescheduledByUserId: auth.user.portalUserId,
      });
      movedBookings.push({
        bookingId: clash.bookingId,
        fullName: clash.fullName,
        outcome: result.outcome,
        newTime: result.outcome === 'moved' ? `${formatDateLabel(result.next.date)}, ${result.next.label}` : null,
      });
    }
    return jsonNoStore({ success: true, timeOffId, movedBookings }, 201);
  } catch (err) {
    console.error('Time off create error:', err.message);
    return jsonNoStore({ error: 'Could not save' }, 500);
  }
}
