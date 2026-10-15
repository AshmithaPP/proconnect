import 'server-only';
import { getBookingById } from '@/features/booking/booking.repository';
import { listPortalUsersByRole } from '@/features/auth/portal-user.repository';
import { getSetting } from '@/features/settings/settings.repository';
import { createRescheduleToken } from '@/features/reschedule/reschedule.repository';
import { formatAmount } from '@/features/payments/format-amount';
import { sendTemplatedEmail } from '@/features/email/mailer';
import { formatDateLabel, formatSlotLabel } from '@/features/schedule/slot-engine';

const withOther = (value, other) => (value === 'Other' && other ? `Other (${other})` : value || '—');

/** Customer-facing explanation per reason (also shown on the payment result page) */
export const RESCHEDULE_REASON_TEXT = {
  slot_taken: 'Another client paid for your chosen time a moment before you, so we booked the next free slot for you.',
  consultant_unavailable: 'The consultant is no longer available at your chosen time, so we moved you to the next free slot.',
  customer_request: 'Your consultation has been moved to the time you chose.',
};

/** Shorter wording for the consultant */
const CONSULTANT_REASON_TEXT = {
  slot_taken: 'Two clients paid for the same slot — the first kept it, this one was moved automatically.',
  consultant_unavailable: 'You marked the original time unavailable — moved automatically.',
  customer_request: 'The client chose a new time.',
};

/** Absolute site URL for links in emails (no request available here) */
async function getPublicSiteUrl() {
  const seo = await getSetting('seo');
  return (process.env.NEXT_PUBLIC_APP_URL || seo.canonicalUrl || 'http://localhost:3000').replace(/\/+$/, '');
}

const slotText = (date, startTime, endTime) => `${formatDateLabel(date)}, ${formatSlotLabel(startTime, endTime)}`;

async function bookingVariables(booking) {
  return {
    client_name: booking.fullName,
    company_name: booking.companyName,
    client_email: booking.workEmail,
    client_phone: booking.phoneNumber,
    client_role: withOther(booking.userRole, booking.userRoleOther),
    team_size: booking.salesTeamSize || '—',
    sales_challenge: withOther(booking.salesChallenge, booking.salesChallengeOther),
    slot_time: slotText(booking.consultationDate, booking.slotStartTime, booking.slotEndTime),
    amount: booking.payment
      ? `${formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)} ${booking.payment.currencyCode}`
      : '—',
    booking_reference: booking.bookingId.slice(0, 8).toUpperCase(),
    payment_id: booking.payment?.providerPaymentId || '—',
    reschedule_link: `${await getPublicSiteUrl()}/booking/reschedule?token=${await createRescheduleToken(booking.bookingId)}`,
  };
}

async function activeConsultantEmails() {
  return (await listPortalUsersByRole('consultant')).filter((c) => c.accountStatus === 'active').map((c) => c.email);
}

async function sendToCustomerAndConsultants({ booking, customerTemplate, consultantTemplate, customerVariables, consultantVariables }) {
  const consultants = await activeConsultantEmails();
  await Promise.all([
    sendTemplatedEmail({ templateKey: customerTemplate, to: booking.workEmail, variables: customerVariables, bookingId: booking.bookingId }),
    ...consultants.map((email) =>
      sendTemplatedEmail({ templateKey: consultantTemplate, to: email, variables: consultantVariables, bookingId: booking.bookingId })
    ),
  ]);
}

/**
 * Confirmation to the customer + notification to every active consultant, sent once when a
 * booking is first marked paid. Never throws (each send logs its own result).
 * @param {string} bookingId
 */
export async function sendBookingConfirmationEmails(bookingId) {
  try {
    const booking = await getBookingById(bookingId);
    if (!booking || booking.status !== 'paid') return;
    const variables = await bookingVariables(booking);
    await sendToCustomerAndConsultants({
      booking,
      customerTemplate: 'booking_confirmed_customer',
      consultantTemplate: 'booking_notification_consultant',
      customerVariables: variables,
      consultantVariables: variables,
    });
  } catch (err) {
    console.error('[Email] Booking confirmation emails failed:', bookingId, err.message);
  }
}

/**
 * "Your time changed" to the customer + consultants, after any move.
 * @param {string} bookingId
 * @param {{ previous: { date: string, startTime: string, endTime: string }, reason: keyof RESCHEDULE_REASON_TEXT }} move
 */
export async function sendRescheduledEmails(bookingId, { previous, reason }) {
  try {
    const booking = await getBookingById(bookingId);
    if (!booking) return;
    const variables = {
      ...(await bookingVariables(booking)),
      previous_slot_time: slotText(previous.date, previous.startTime, previous.endTime),
    };
    await sendToCustomerAndConsultants({
      booking,
      customerTemplate: 'booking_rescheduled_customer',
      consultantTemplate: 'booking_rescheduled_consultant',
      customerVariables: { ...variables, reschedule_reason: RESCHEDULE_REASON_TEXT[reason] },
      consultantVariables: { ...variables, reschedule_reason: CONSULTANT_REASON_TEXT[reason] },
    });
  } catch (err) {
    console.error('[Email] Reschedule emails failed:', bookingId, err.message);
  }
}

/**
 * Rare: no free slot in the next 30 days — tell the customer it will be booked automatically,
 * and alert consultants to open availability.
 * @param {string} bookingId
 */
export async function sendReschedulePendingEmails(bookingId) {
  try {
    const booking = await getBookingById(bookingId);
    if (!booking) return;
    const variables = {
      ...(await bookingVariables(booking)),
      previous_slot_time: slotText(booking.consultationDate, booking.slotStartTime, booking.slotEndTime),
    };
    await sendToCustomerAndConsultants({
      booking,
      customerTemplate: 'booking_reschedule_pending_customer',
      consultantTemplate: 'booking_reschedule_pending_consultant',
      customerVariables: variables,
      consultantVariables: variables,
    });
  } catch (err) {
    console.error('[Email] Reschedule-pending emails failed:', bookingId, err.message);
  }
}
