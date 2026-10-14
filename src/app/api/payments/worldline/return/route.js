import { NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/http/app-url';
import {
  getBookingByProviderOrderId,
  markBookingPaymentSucceeded,
  markBookingCancelled,
} from '@/features/booking/booking.repository';
import { getHostedCheckoutStatus } from '@/features/payments/worldline.client';

/**
 * GET /api/payments/worldline/return
 *
 * Invoked when the customer finishes their payment session on Worldline's hosted checkout page.
 * Worldline appends query parameters:
 *  - hostedCheckoutId: The session identifier
 *  - RETURNMAC: The message authentication code
 *
 * Workflow:
 *  1. Requires a hostedCheckoutId that we issued and stored for a booking
 *     (the booking is resolved from the DB, never from client-supplied bookingId).
 *  2. DUAL VERIFICATION: Server calls Worldline (GET /v1/{merchantId}/hostedCheckouts/{id})
 *     to confirm that the payment actually succeeded on Worldline's bank servers.
 *  3. Paid → confirm booking. Definitive failure → cancel (slot stays free).
 *     Unknown yet (IN_PROGRESS) → leave pending and show a 'processing' page.
 *  4. Redirects the customer to the friendly /payment-status receipt page.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hostedCheckoutId = searchParams.get('hostedCheckoutId');

  const appBaseUrl = getAppBaseUrl(request);
  const statusUrl = (params) => `${appBaseUrl}/payment-status?${new URLSearchParams(params).toString()}`;

  if (!hostedCheckoutId) {
    return NextResponse.redirect(statusUrl({ status: 'error', message: 'missing_parameters' }));
  }

  // 1. The checkout session must belong to a booking we created
  const booking = await getBookingByProviderOrderId(hostedCheckoutId);
  if (!booking) {
    return NextResponse.redirect(statusUrl({ status: 'error', message: 'unknown_checkout_session' }));
  }

  const { bookingId } = booking;

  // Already confirmed (e.g. customer refreshed the return URL) — just show the receipt
  if (booking.payment?.paymentStatus === 'paid') {
    return NextResponse.redirect(
      statusUrl({ bookingId, status: 'success', paymentId: booking.payment.providerPaymentId || '' })
    );
  }

  try {
    // 2. DUAL VERIFICATION: Ask Worldline directly if payment was authorized
    const verification = await getHostedCheckoutStatus(hostedCheckoutId);

    if (verification.isPaid) {
      // Defence in depth: the captured amount must match what this booking costs
      const expected = booking.payment;
      if (
        (verification.amount !== undefined && Number(verification.amount) !== Number(expected.amountPaise)) ||
        (verification.currency !== undefined && verification.currency !== expected.currencyCode)
      ) {
        console.error('[Worldline Return] Amount mismatch — booking left pending for review:', {
          bookingId,
          hostedCheckoutId,
          expected: `${expected.amountPaise} ${expected.currencyCode}`,
          received: `${verification.amount} ${verification.currency}`,
        });
        return NextResponse.redirect(statusUrl({ bookingId, status: 'error', reason: 'amount_mismatch' }));
      }

      // 3. Mark booking as paid and confirmed in MySQL
      const result = await markBookingPaymentSucceeded({
        bookingId,
        paymentProvider: 'worldline',
        providerPaymentId: verification.paymentId || hostedCheckoutId,
        providerOrderId: hostedCheckoutId,
      });

      if (result.outcome === 'not_found') {
        // Booking was cancelled before the gateway confirmed payment — needs manual follow-up/refund
        console.error('[Worldline Return] Payment confirmed for cancelled booking:', bookingId, hostedCheckoutId);
        return NextResponse.redirect(statusUrl({ bookingId, status: 'error', reason: 'booking_cancelled' }));
      }

      // 4. Redirect to public success receipt page
      return NextResponse.redirect(
        statusUrl({ bookingId, status: 'success', paymentId: verification.paymentId || '' })
      );
    }

    if (verification.isFinalFailure) {
      // Definitively not paid (cancelled / rejected) — release the slot
      await markBookingCancelled(bookingId);
      const cancelledByCustomer = verification.status === 'CANCELLED_BY_CONSUMER';
      return NextResponse.redirect(
        statusUrl({ bookingId, status: cancelledByCustomer ? 'cancelled' : 'failed', reason: verification.status })
      );
    }

    // Outcome not known yet (IN_PROGRESS / STATUS_UNKNOWN): keep the booking pending
    return NextResponse.redirect(statusUrl({ bookingId, status: 'processing' }));
  } catch (err) {
    console.error('[Worldline Return Error]:', err.message);
    return NextResponse.redirect(statusUrl({ bookingId, status: 'error', reason: 'verification_failed' }));
  }
}
