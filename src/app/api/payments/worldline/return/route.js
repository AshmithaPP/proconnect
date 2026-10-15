import { NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/http/app-url';
import { getBookingByProviderOrderId } from '@/features/booking/booking.repository';
import { reconcileWorldlineBooking } from '@/features/payments/worldline.reconcile';

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
 *  3. Authorised-only → capture. Paid → confirm booking. Definitive failure → cancel (slot stays free).
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

  try {
    // 2-3. Verify with Worldline (capturing an authorised-only payment) and update MySQL
    const result = await reconcileWorldlineBooking(booking);

    switch (result.outcome) {
      case 'rescheduled':
        return NextResponse.redirect(statusUrl({ bookingId, status: 'success', paymentId: result.paymentId || '' }));
      case 'reschedule_required':
        return NextResponse.redirect(statusUrl({ bookingId, status: 'reschedule' }));
      case 'paid':
        // 4. Redirect to public success receipt page
        return NextResponse.redirect(statusUrl({ bookingId, status: 'success', paymentId: result.paymentId || '' }));
      case 'amount_mismatch':
      case 'booking_cancelled':
        return NextResponse.redirect(statusUrl({ bookingId, status: 'error', reason: result.outcome }));
      case 'cancelled':
      case 'failed':
        return NextResponse.redirect(statusUrl({ bookingId, status: result.outcome, reason: result.reason }));
      default:
        return NextResponse.redirect(statusUrl({ bookingId, status: 'processing' }));
    }
  } catch (err) {
    console.error('[Worldline Return Error]:', err.message);
    return NextResponse.redirect(statusUrl({ bookingId, status: 'error', reason: 'verification_failed' }));
  }
}
