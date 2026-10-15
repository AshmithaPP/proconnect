import { NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { validateBookingInput } from '@/features/booking/booking.schema';
import { checkRateLimit, recordFailedAttempt } from '@/lib/security/rate-limit';
import { createBookingWithPendingPayment } from '@/features/booking/booking.repository';
import { getPaymentMode } from '@/features/payments/payment.config';
import { checkSlotBookable } from '@/features/schedule/schedule.repository';

const SLOT_UNAVAILABLE_MESSAGES = {
  booked: 'This time slot has just been booked. Please choose another one.',
  blocked: 'The consultant is not available at this time. Please choose another slot.',
  past: 'This time slot is no longer available. Please choose a later one.',
  outside_window: 'This date is outside the booking window. Please choose another date.',
  not_a_slot: 'This time slot is not available. Please choose another one.',
};

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

  // 4. The slot must be bookable right now (window, hours, notice, time off, not paid by someone)
  const { consultationDate, slotStartTime } = validation.booking;
  const slotCheck = await checkSlotBookable(consultationDate, slotStartTime);
  if (!slotCheck.ok) {
    return NextResponse.json(
      {
        error: SLOT_UNAVAILABLE_MESSAGES[slotCheck.reason] || SLOT_UNAVAILABLE_MESSAGES.not_a_slot,
        fieldErrors: { slotKey: 'Please choose another slot' },
      },
      { status: 409, headers: NO_STORE }
    );
  }

  // 5. The fee is set by the consultant — never create ₹0 bookings by accident
  const amountPaise = slotCheck.rules.consultationFeePaise;
  const currencyCode = 'INR';
  if (getPaymentMode() !== 'disabled' && !(amountPaise > 0)) {
    console.error('Booking rejected: consultation fee is not set');
    return NextResponse.json(
      { error: 'Bookings are temporarily unavailable. Please try again later.' },
      { status: 503, headers: NO_STORE }
    );
  }

  // 6. Persist booking + pending payment
  try {
    const { bookingId, paymentId } = await createBookingWithPendingPayment({
      booking: { ...validation.booking, slotEndTime: slotCheck.slot.endTime, preferredTimeSlot: slotCheck.slot.label },
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
          consultationDate,
          slotLabel: slotCheck.slot.label,
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
    console.error('Booking creation error:', err.message);
    return NextResponse.json(
      { error: 'Could not save your booking. Please try again.' },
      { status: 500, headers: NO_STORE }
    );
  }
}
