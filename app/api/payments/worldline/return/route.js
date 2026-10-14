import { NextResponse } from 'next/server';
import {
  getBookingByProviderOrderId,
  getBookingById,
  markBookingPaymentSucceeded,
  markBookingCancelled,
} from '@/lib/data-access/consultation-bookings';
import { getHostedCheckoutStatus } from '@/lib/payments/worldline';

/**
 * GET /api/payments/worldline/return
 * 
 * Invoked when the customer finishes their payment session on Worldline's hosted checkout page.
 * Worldline appends query parameters:
 *  - hostedCheckoutId: The session identifier
 *  - RETURNMAC: The message authentication code
 * 
 * Workflow:
 *  1. Extracts the hostedCheckoutId.
 *  2. DUAL VERIFICATION: Server calls Worldline (GET /v1/{merchantId}/hostedCheckouts/{id})
 *     to confirm that the payment actually succeeded on Worldline's bank servers.
 *  3. Updates MySQL booking to 'confirmed' and payment to 'paid'.
 *  4. Redirects the customer to the friendly /payment-status receipt page.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hostedCheckoutId = searchParams.get('hostedCheckoutId');
  const queryBookingId = searchParams.get('bookingId');
  const simulatedAction = searchParams.get('action'); // For developer simulator triggers

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!hostedCheckoutId && !queryBookingId) {
    return NextResponse.redirect(`${appBaseUrl}/payment-status?status=error&message=missing_parameters`);
  }

  // Find the corresponding booking in our database
  let booking = null;
  if (hostedCheckoutId) {
    booking = await getBookingByProviderOrderId(hostedCheckoutId);
  }
  if (!booking && queryBookingId) {
    booking = await getBookingById(queryBookingId);
  }

  const bookingId = booking?.bookingId || queryBookingId || '';

  // Handle explicit cancellation
  if (simulatedAction === 'cancel') {
    if (bookingId) {
      await markBookingCancelled(bookingId);
    }
    return NextResponse.redirect(`${appBaseUrl}/payment-status?bookingId=${bookingId}&status=cancelled`);
  }

  // Handle explicit failure simulation
  if (simulatedAction === 'fail') {
    if (bookingId) {
      await markBookingCancelled(bookingId);
    }
    return NextResponse.redirect(`${appBaseUrl}/payment-status?bookingId=${bookingId}&status=failed`);
  }

  try {
    // 2. DUAL VERIFICATION: Ask Worldline directly if payment was authorized
    const verification = await getHostedCheckoutStatus(hostedCheckoutId || `MOCK_WL_${Date.now()}`);

    if (verification.isPaid) {
      // 3. Mark booking as paid and confirmed in MySQL
      if (bookingId) {
        await markBookingPaymentSucceeded({
          bookingId,
          paymentProvider: 'worldline',
          providerPaymentId: verification.paymentId || hostedCheckoutId,
          providerOrderId: hostedCheckoutId,
        });
      }

      // 4. Redirect to public success receipt page
      return NextResponse.redirect(
        `${appBaseUrl}/payment-status?bookingId=${bookingId}&status=success&paymentId=${encodeURIComponent(
          verification.paymentId || ''
        )}`
      );
    } else {
      // Payment was not authorized or is still pending
      if (bookingId) {
        await markBookingCancelled(bookingId);
      }
      return NextResponse.redirect(
        `${appBaseUrl}/payment-status?bookingId=${bookingId}&status=failed&reason=${encodeURIComponent(
          verification.status
        )}`
      );
    }
  } catch (err) {
    console.error('[Worldline Return Error]:', err.message);
    return NextResponse.redirect(
      `${appBaseUrl}/payment-status?bookingId=${bookingId}&status=error&message=${encodeURIComponent(err.message)}`
    );
  }
}
