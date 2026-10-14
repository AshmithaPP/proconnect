import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/validation/origin';
import { markBookingPaymentSucceeded } from '@/lib/data-access/consultation-bookings';
import { getPaymentMode } from '@/lib/booking/payment-config';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/:bookingId/mock-payment
 * TEMPORARY stand-in for the payment gateway. Only active when PAYMENT_MODE=mock;
 * returns 404 otherwise. Remove once the real gateway webhook is in place.
 */
export async function POST(request, { params }) {
  if (getPaymentMode() !== 'mock') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json(
      { error: originCheck.error || 'Forbidden' },
      { status: 403, headers: NO_STORE }
    );
  }

  const { bookingId } = await params;
  if (!UUID_REGEX.test(bookingId || '')) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await markBookingPaymentSucceeded({
      bookingId,
      paymentProvider: 'mock',
      providerPaymentId: `mock_${crypto.randomUUID()}`,
    });

    if (result.outcome === 'not_found') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404, headers: NO_STORE });
    }

    return NextResponse.json(
      {
        success: true,
        booking: {
          bookingId,
          bookingStatus: 'confirmed',
          payment: {
            paymentId: result.paymentId,
            paymentStatus: 'paid',
            paidAt: result.paidAt,
          },
        },
        alreadyPaid: result.outcome === 'already_paid',
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error('Mock payment error:', err.message);
    return NextResponse.json(
      { error: 'Could not confirm payment. Please try again.' },
      { status: 500, headers: NO_STORE }
    );
  }
}
