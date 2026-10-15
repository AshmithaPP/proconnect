import { NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/security/origin';
import { rescheduleByCustomer } from '@/features/reschedule/reschedule.service';
import { formatDateLabel } from '@/features/schedule/slot-engine';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/bookings/reschedule — the customer picks a new time from the link in their email.
 * Body: { token, slotKey }
 * Public, authorised only by the secret link token (256-bit, stored hashed, expires). Enforces
 * the consultant's rules: cut-off hours before the consultation and max changes per booking.
 */
export async function POST(request) {
  const originCheck = verifyRequestOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: originCheck.error || 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await rescheduleByCustomer(String(body?.token || ''), String(body?.slotKey || ''));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    return NextResponse.json(
      {
        success: true,
        newTime: `${formatDateLabel(result.next.date)}, ${result.next.label}`,
        consultationDate: result.next.date,
        slotStartTime: result.next.startTime,
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error('Customer reschedule error:', err.message);
    return NextResponse.json({ error: 'Could not change your booking. Please try again.' }, { status: 500, headers: NO_STORE });
  }
}
