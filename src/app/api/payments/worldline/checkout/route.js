import { NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { getBookingById, updateBookingPaymentOrderId } from '@/features/booking/booking.repository';
import { createHostedCheckoutSession } from '@/features/payments/worldline.client';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/payments/worldline/checkout
 * 
 * Called by the frontend booking form when a customer is ready to pay.
 * Receives: { bookingId: "uuid-..." }
 * 
 * Actions:
 *  1. Verifies same-origin CSRF protection.
 *  2. Retrieves booking & pending payment record from MySQL.
 *  3. Calls Worldline Connect API (POST /v1/{merchantId}/hostedCheckouts).
 *  4. Saves the Worldline hostedCheckoutId in booking_payments table.
 *  5. Returns { redirectUrl, hostedCheckoutId } so frontend can navigate.
 */
export async function POST(request) {
  // 1. CSRF Protection: Ensure request originated from our own website
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json(
      { error: originCheck.error || 'Forbidden' },
      { status: 403, headers: NO_STORE }
    );
  }

  // 2. Parse request payload
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400, headers: NO_STORE });
  }

  const { bookingId } = body;
  if (!UUID_REGEX.test(bookingId || '')) {
    return NextResponse.json({ error: 'Invalid booking UUID' }, { status: 400, headers: NO_STORE });
  }

  // 3. Retrieve booking record from MySQL
  const booking = await getBookingById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404, headers: NO_STORE });
  }

  if (booking.bookingStatus === 'confirmed' || booking.payment?.paymentStatus === 'paid') {
    return NextResponse.json(
      { error: 'This booking has already been paid and confirmed.' },
      { status: 400, headers: NO_STORE }
    );
  }

  // 4. Construct absolute return URL where Worldline will redirect customer back
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const returnUrl = `${appBaseUrl}/api/payments/worldline/return`;

  try {
    // 5. Call Worldline Create Hosted Checkout API
    const session = await createHostedCheckoutSession({
      bookingId: booking.bookingId,
      amountPaise: booking.payment.amountPaise,
      currencyCode: booking.payment.currencyCode || 'INR',
      customer: {
        fullName: booking.fullName,
        email: booking.workEmail,
        phone: booking.phoneNumber,
        company: booking.companyName,
      },
      returnUrl,
    });

    // 6. Record Worldline session ID in database
    await updateBookingPaymentOrderId(booking.bookingId, session.hostedCheckoutId, 'worldline');

    return NextResponse.json(
      {
        success: true,
        hostedCheckoutId: session.hostedCheckoutId,
        redirectUrl: session.redirectUrl,
        isMock: session.isMock || false,
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    console.error('[Worldline Checkout Initiation Error]:', error);
    return NextResponse.json(
      { error: 'Could not connect to Worldline payment gateway. Please try again.' },
      { status: 500, headers: NO_STORE }
    );
  }
}
