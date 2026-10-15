import 'server-only';
import { getBookingById } from '@/features/booking/booking.repository';
import { listPortalUsersByRole } from '@/features/auth/portal-user.repository';
import { formatAmount } from '@/features/payments/format-amount';
import { sendTemplatedEmail } from '@/features/email/mailer';
import { formatDateLabel } from '@/features/schedule/slot-engine';

const withOther = (value, other) => (value === 'Other' && other ? `Other (${other})` : value || '—');

/**
 * Confirmation to the customer + notification to every active consultant, sent once when a
 * booking is first marked paid. Never throws (each send logs its own result).
 * @param {string} bookingId
 */
export async function sendBookingConfirmationEmails(bookingId) {
  try {
    const booking = await getBookingById(bookingId);
    if (!booking || booking.status !== 'paid') return;

    const variables = {
      client_name: booking.fullName,
      company_name: booking.companyName,
      client_email: booking.workEmail,
      client_phone: booking.phoneNumber,
      client_role: withOther(booking.userRole, booking.userRoleOther),
      team_size: booking.salesTeamSize || '—',
      sales_challenge: withOther(booking.salesChallenge, booking.salesChallengeOther),
      slot_time: `${formatDateLabel(booking.consultationDate)}, ${booking.preferredTimeSlot}`,
      amount: `${formatAmount(booking.payment.amountPaise, booking.payment.currencyCode)} ${booking.payment.currencyCode}`,
      booking_reference: booking.bookingId.slice(0, 8).toUpperCase(),
      payment_id: booking.payment.providerPaymentId || '—',
    };

    const consultants = (await listPortalUsersByRole('consultant')).filter((c) => c.accountStatus === 'active');

    await Promise.all([
      sendTemplatedEmail({ templateKey: 'booking_confirmed_customer', to: booking.workEmail, variables, bookingId }),
      ...consultants.map((consultant) =>
        sendTemplatedEmail({ templateKey: 'booking_notification_consultant', to: consultant.email, variables, bookingId })
      ),
    ]);
  } catch (err) {
    console.error('[Email] Booking confirmation emails failed:', bookingId, err.message);
  }
}
