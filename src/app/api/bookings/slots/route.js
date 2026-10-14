import { NextResponse } from 'next/server';
import { getUnavailableTimeSlots } from '@/features/booking/booking.repository';
import { TIME_SLOTS } from '@/features/booking/booking.options';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * GET /api/bookings/slots
 * 
 * Public endpoint to fetch currently unavailable consultation time slots.
 * Any slot with a confirmed booking today, or currently held in active checkout,
 * will be returned in `unavailableSlots` so the UI can disable it.
 */
export async function GET() {
  try {
    const unavailableSlots = await getUnavailableTimeSlots();

    return NextResponse.json(
      {
        success: true,
        unavailableSlots,
        totalSlots: TIME_SLOTS.length,
        availableSlotsCount: Math.max(0, TIME_SLOTS.length - unavailableSlots.length),
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error('Failed to fetch slot availability:', err);
    return NextResponse.json(
      { success: false, unavailableSlots: [] },
      { status: 500, headers: NO_STORE }
    );
  }
}
