import 'server-only';
import { getAuthenticatedCalendarClient } from '@/features/google/google-auth.service';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Creates a Google Calendar event with a genuine Google Meet video link on the authenticated calendar.
 *
 * @param {object} params
 * @param {object} params.booking - Consultation booking record
 * @param {string} [params.consultantEmail] - Email of the consultant to include as attendee
 * @returns {Promise<{ success: boolean, meetLink?: string, calendarEventId?: string, error?: string }>}
 */
export async function createConsultationMeetEvent({ booking, consultantEmail = null }) {
  const calendar = await getAuthenticatedCalendarClient();
  if (!calendar) {
    console.warn('[Google Meet] Calendar client is not connected. Skipping Google Meet generation.');
    return { success: false, error: 'Google Calendar is not connected in Admin Settings.' };
  }

  const startIso = `${booking.consultationDate}T${booking.slotStartTime}:00+05:30`;
  const endIso = `${booking.consultationDate}T${booking.slotEndTime}:00+05:30`;
  const refCode = (booking.bookingId || '').slice(0, 8).toUpperCase();

  const attendees = [];
  if (booking.workEmail) {
    attendees.push({ email: booking.workEmail, displayName: booking.fullName });
  }
  if (consultantEmail) {
    attendees.push({ email: consultantEmail, displayName: 'Sales Strategy Consultant' });
  }

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Google automatically sends the calendar invite email with Google Meet button
      requestBody: {
        summary: `Strategy Consultation: ${booking.fullName} — PreConnect`,
        description:
          `Confirmed 1-on-1 Consultation\n` +
          `Client: ${booking.fullName}\n` +
          `Company: ${booking.companyName || '—'}\n` +
          `Phone: ${booking.phoneNumber || '—'}\n` +
          `Booking Reference: ${refCode}\n\n` +
          `Please join via the Google Meet link attached to this invite.`,
        start: {
          dateTime: startIso,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: endIso,
          timeZone: TIMEZONE,
        },
        attendees,
        guestsCanInviteOthers: false, // Prevents guests from sharing or inviting non-registered participants
        guestsCanModify: false, // Prevents guests from altering the meeting
        guestsCanSeeOtherGuests: false, // Protects attendee privacy
        conferenceData: {
          createRequest: {
            requestId: `pc-${booking.bookingId}`, // Idempotent: safe against retries
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    const event = res.data;
    const meetLink =
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      null;

    console.info(`[Google Meet] Event created: ${event.id}, Meet Link: ${meetLink}`);

    return {
      success: true,
      meetLink,
      calendarEventId: event.id,
    };
  } catch (err) {
    console.error('[Google Meet] Event creation failed:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Updates an existing Google Calendar event when a booking is automatically moved (e.g. checkout concurrency slot_taken).
 *
 * @param {object} params
 * @param {string} params.calendarEventId
 * @param {string} params.newDate - "YYYY-MM-DD"
 * @param {string} params.newStartTime - "HH:MM"
 * @param {string} params.newEndTime - "HH:MM"
 */
export async function updateConsultationMeetTime({ calendarEventId, newDate, newStartTime, newEndTime }) {
  if (!calendarEventId) return { success: false, error: 'No calendar event ID provided' };

  const calendar = await getAuthenticatedCalendarClient();
  if (!calendar) return { success: false, error: 'Google Calendar is not connected' };

  const startIso = `${newDate}T${newStartTime}:00+05:30`;
  const endIso = `${newDate}T${newEndTime}:00+05:30`;

  try {
    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId: calendarEventId,
      sendUpdates: 'all', // Emails attendees the updated consultation time
      requestBody: {
        start: { dateTime: startIso, timeZone: TIMEZONE },
        end: { dateTime: endIso, timeZone: TIMEZONE },
      },
    });

    return { success: true, eventId: res.data.id };
  } catch (err) {
    console.error(`[Google Meet] Could not update event ${calendarEventId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Runs a quick real-time test creating and deleting a temporary calendar event with Google Meet.
 * Used in Admin Settings to verify live permissions.
 */
export async function testGoogleCalendarConnection() {
  const calendar = await getAuthenticatedCalendarClient();
  if (!calendar) return { success: false, error: 'Google Calendar is not connected' };

  try {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

    const res = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'none',
      requestBody: {
        summary: '[PreConnect Test] Google Meet Verification',
        description: 'Temporary verification event created from PreConnect Admin Settings. Can be safely removed.',
        start: { dateTime: start },
        end: { dateTime: end },
        conferenceData: {
          createRequest: {
            requestId: `test-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink =
      res.data.hangoutLink ||
      res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      null;

    // Clean up test event immediately
    if (res.data.id) {
      await calendar.events.delete({ calendarId: 'primary', eventId: res.data.id, sendUpdates: 'none' }).catch(() => {});
    }

    return {
      success: true,
      meetLink,
      message: 'Google Calendar API verified successfully. Live Google Meet link generated!',
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
