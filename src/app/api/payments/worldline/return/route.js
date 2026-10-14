import { NextResponse } from 'next/server';
import {
  getBookingByProviderOrderId,
  markBookingPaymentSucceeded,
  markBookingCancelled,
} from '@/features/booking/booking.repository';
import { getHostedCheckoutStatus } from '@/features/payments/worldline.client';
import { isMockGatewayEnabled } from '@/features/payments/payment.config';

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
 *  3. Updates MySQL booking to 'confirmed' and payment to 'paid' — or cancels it so the slot stays free.
 *  4. Redirects the customer to the friendly /payment-status receipt page.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hostedCheckoutId = searchParams.get('hostedCheckoutId');
  const simulatedAction = searchParams.get('action'); // Simulator only (WORLDLINE_ENV=mock)

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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

  // Simulator buttons (cancel / decline) are honoured only when the simulator is enabled
  if (isMockGatewayEnabled() && (simulatedAction === 'cancel' || simulatedAction === 'fail')) {
    await markBookingCancelled(bookingId);
    return NextResponse.redirect(
      statusUrl({ bookingId, status: simulatedAction === 'cancel' ? 'cancelled' : 'failed' })
    );
  }

  try {
    // 2. DUAL VERIFICATION: Ask Worldline directly if payment was authorized
    const verification = await getHostedCheckoutStatus(hostedCheckoutId);

    if (verification.isPaid) {
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
        return NextResponse.redirect(statusUrl({ bookingId, status: 'error', message: 'booking_cancelled' }));
      }

      // 4. Redirect to public success receipt page
      return NextResponse.redirect(
        statusUrl({ bookingId, status: 'success', paymentId: verification.paymentId || '' })
      );
    }

    // Payment was not authorized, cancelled, or still pending — release the slot
    await markBookingCancelled(bookingId);
    return NextResponse.redirect(statusUrl({ bookingId, status: 'failed', reason: verification.status }));
  } catch (err) {
    console.error('[Worldline Return Error]:', err.message);
    return NextResponse.redirect(statusUrl({ bookingId, status: 'error', message: err.message }));
  }
}
