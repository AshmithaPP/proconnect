import { NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/validation/origin';
import { validateBookingInput } from '@/lib/validation/booking';
import { checkRateLimit, recordFailedAttempt } from '@/lib/validation/rate-limit';
import { createBookingWithPendingPayment } from '@/lib/data-access/consultation-bookings';
import { getPaymentMode, getConsultationFee } from '@/lib/booking/payment-config';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/bookings
 * Public endpoint: stores a consultation booking with a pending payment.
 * The booking becomes "confirmed" only once its payment is marked paid.
 */
export async function POST(request) {
  // 1. CSRF: reject cross-origin submissions
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json(
      { error: originCheck.error || 'Forbidden' },
      { status: 403, headers: NO_STORE }
    );
  }

  // 2. Throttle submissions per client IP (Rate limiting temporarily commented out for development)
  // const forwardedFor = request.headers.get('x-forwarded-for');
  // const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  // const rateLimitKey = `${clientIp}:booking`;
  // const rateStatus = await checkRateLimit(rateLimitKey, 'booking');
  // if (!rateStatus.allowed) { ... }

  // 3. Parse & validate payload
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400, headers: NO_STORE });
  }

  const validation = validateBookingInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, fieldErrors: validation.fieldErrors },
      { status: 400, headers: NO_STORE }
    );
  }

  // 4. Persist booking + pending payment
  try {
    const { amountPaise, currencyCode } = getConsultationFee();
    const { bookingId, paymentId } = await createBookingWithPendingPayment({
      booking: validation.booking,
      amountPaise,
      currencyCode,
    });

    // Every stored booking counts toward the per-IP limit (commented out for dev)
    // await recordFailedAttempt(rateLimitKey, 'booking');

    return NextResponse.json(
      {
        success: true,
        paymentMode: getPaymentMode(),
        booking: {
          bookingId,
          bookingStatus: 'pending_payment',
          payment: {
            paymentId,
            amountPaise,
            currencyCode,
            paymentStatus: 'pending',
          },
        },
      },
      { status: 201, headers: NO_STORE }
    );
  } catch (err) {
    if (err.code === 'SLOT_ALREADY_BOOKED') {
      return NextResponse.json(
        {
          error: `The time slot "${err.timeSlot}" is already booked. Please choose another time slot.`,
          fieldErrors: { timeSlot: 'This time slot is already reserved.' },
        },
        { status: 409, headers: NO_STORE }
      );
    }
    console.error('Booking creation error:', err.message);
    return NextResponse.json(
      { error: 'Could not save your booking. Please try again.' },
      { status: 500, headers: NO_STORE }
    );
  }
}
