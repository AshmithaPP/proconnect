import 'server-only';
import { markBookingPaymentSucceeded, markBookingCancelled } from '@/features/booking/booking.repository';
import { getHostedCheckoutStatus, capturePayment } from '@/features/payments/worldline.client';
import { sendBookingConfirmationEmails } from '@/features/email/booking-emails';

/**
 * Brings a booking in line with what Worldline says about its hosted checkout.
 * Used by the return route and by the payment-status page (so "refresh" re-checks).
 *
 * @param {object} booking - from getBookingByProviderOrderId / getBookingById
 * @returns {Promise<{
 *   outcome: 'paid' | 'cancelled' | 'failed' | 'processing' | 'amount_mismatch' | 'booking_cancelled',
 *   paymentId?: string,
 *   reason?: string
 * }>}
 */
export async function reconcileWorldlineBooking(booking) {
  const { bookingId, payment } = booking;
  const hostedCheckoutId = payment?.providerOrderId;

  // Already confirmed (e.g. customer refreshed the return URL)
  if (payment?.paymentStatus === 'paid') {
    return { outcome: 'paid', paymentId: payment.providerPaymentId || '' };
  }
  if (!hostedCheckoutId) return { outcome: 'processing' };

  // DUAL VERIFICATION: ask Worldline directly
  const verification = await getHostedCheckoutStatus(hostedCheckoutId);

  if (verification.isPaid || verification.needsCapture) {
    // Defence in depth: the amount must match what this booking costs — checked BEFORE capturing
    if (
      (verification.amount !== undefined && Number(verification.amount) !== Number(payment.amountPaise)) ||
      (verification.currency !== undefined && verification.currency !== payment.currencyCode)
    ) {
      console.error('[Worldline] Amount mismatch — booking left pending for review:', {
        bookingId,
        hostedCheckoutId,
        expected: `${payment.amountPaise} ${payment.currencyCode}`,
        received: `${verification.amount} ${verification.currency}`,
      });
      return { outcome: 'amount_mismatch' };
    }

    if (verification.needsCapture) {
      const capture = await capturePayment(verification.paymentId, Number(payment.amountPaise));
      if (!capture.isPaid) {
        console.error('[Worldline] Capture did not complete:', bookingId, capture.status);
        return { outcome: 'processing' };
      }
    }

    const result = await markBookingPaymentSucceeded({
      bookingId,
      paymentProvider: 'worldline',
      providerPaymentId: verification.paymentId || hostedCheckoutId,
      providerOrderId: hostedCheckoutId,
    });

    if (result.outcome === 'not_found') {
      // Booking was cancelled before the gateway confirmed payment — needs manual follow-up/refund
      console.error('[Worldline] Payment confirmed for cancelled booking:', bookingId, hostedCheckoutId);
      return { outcome: 'booking_cancelled' };
    }

    // First confirmation only (not a refresh of an already-paid booking). Not awaited:
    // the customer's redirect must not wait on the mail server.
    if (result.outcome === 'paid') {
      void sendBookingConfirmationEmails(bookingId);
    }
    return { outcome: 'paid', paymentId: verification.paymentId || '' };
  }

  if (verification.isFinalFailure) {
    // Definitively not paid (cancelled / rejected) — release the slot
    await markBookingCancelled(bookingId);
    return {
      outcome: verification.status === 'CANCELLED_BY_CONSUMER' ? 'cancelled' : 'failed',
      reason: verification.status,
    };
  }

  // Outcome not known yet (IN_PROGRESS / STATUS_UNKNOWN / 3-D Secure pending): keep pending
  return { outcome: 'processing' };
}
