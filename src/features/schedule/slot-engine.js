/**
 * SLOT ENGINE — the single place that decides which consultation slots exist and whether
 * each one can be booked. Pure functions, no I/O (client-safe and unit-testable): the
 * booking form, checkout re-check, consultant calendar and analytics all use it, so they
 * can never disagree.
 *
 * Times are wall-clock in the business timezone: dates "YYYY-MM-DD", times "HH:MM".
 */

/** @typedef {{ bookingWindowDays: number, minNoticeMinutes: number, slotDurationMinutes: number, slotGapMinutes: number }} BookingRules */
/** @typedef {{ weekday: number, startTime: string, endTime: string }} WeeklyHours */
/** @typedef {{ timeOffId: string, offDate: string, startTime: string|null, endTime: string|null, timeOffReason?: string|null }} TimeOff */
/** @typedef {{ bookingId: string, consultationDate: string, slotStartTime: string, slotEndTime: string, fullName?: string, companyName?: string }} BookedSlot */

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "10:30" or "10:30:00" → 630 */
export function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/** 630 → "10:30" */
export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** 630 → "10:30 AM" */
export function formatTimeLabel(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** Same format as the original fixed slots: "10:30 AM – 11:00 AM" */
export function formatSlotLabel(startTime, endTime) {
  return `${formatTimeLabel(timeToMinutes(startTime))} – ${formatTimeLabel(timeToMinutes(endTime))}`;
}

/** "2026-10-15" + 2 → "2026-10-17" (calendar arithmetic, timezone-free) */
export function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "2026-10-16" → "Fri, 16 Oct 2026" */
export function formatDateLabel(dateString, { withYear = true } = {}) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/**
 * The current date and minute-of-day in a timezone.
 * @param {string} timezone - IANA name, e.g. "Asia/Kolkata"
 * @param {Date} [now]
 * @returns {{ date: string, minutes: number }}
 */
export function getZonedNow(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** "2026-10-16T10:30" → { date, startTime } or null */
export function parseSlotKey(slotKey) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(slotKey || ''));
  return match ? { date: match[1], startTime: match[2] } : null;
}

const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;

/**
 * Builds the slot calendar for the booking window (today … today + bookingWindowDays − 1).
 *
 * Slot status (first match wins):
 *  - booked    → a confirmed booking overlaps it
 *  - past      → starts before now + minimum notice (today only)
 *  - blocked   → consultant time off (whole day or overlapping range)
 *  - available → can be booked
 *
 * @param {{ rules: BookingRules, weeklyHours: WeeklyHours[], timeOff: TimeOff[],
 *   bookings: BookedSlot[], timezone: string, now?: Date, fromDate?: string, days?: number }} input
 *   fromDate/days override the window (the consultant calendar can look further ahead).
 */
export function buildAvailability({ rules, weeklyHours, timeOff, bookings, timezone, now = new Date(), fromDate, days }) {
  const zonedNow = getZonedNow(timezone, now);
  const startDate = fromDate || zonedNow.date;
  const dayCount = days || rules.bookingWindowDays;
  const duration = rules.slotDurationMinutes;
  const step = duration + rules.slotGapMinutes;
  const earliestToday = zonedNow.minutes + rules.minNoticeMinutes;

  const result = [];
  for (let offset = 0; offset < dayCount; offset++) {
    const date = addDays(startDate, offset);
    const weekday = weekdayOf(date);
    const ranges = weeklyHours
      .filter((h) => h.weekday === weekday)
      .map((h) => ({ start: timeToMinutes(h.startTime), end: timeToMinutes(h.endTime) }))
      .sort((a, b) => a.start - b.start);
    const dayTimeOff = timeOff.filter((t) => t.offDate === date);
    const wholeDayOff = dayTimeOff.find((t) => !t.startTime);
    const dayBookings = bookings.filter((b) => b.consultationDate === date);
    const isPastDay = date < zonedNow.date;

    const slots = [];
    for (const range of ranges) {
      for (let start = range.start; start + duration <= range.end; start += step) {
        const end = start + duration;
        const booking = dayBookings.find((b) => overlaps(start, end, timeToMinutes(b.slotStartTime), timeToMinutes(b.slotEndTime)));
        const rangeOff = dayTimeOff.find(
          (t) => t.startTime && overlaps(start, end, timeToMinutes(t.startTime), timeToMinutes(t.endTime))
        );
        const isPast = isPastDay || (date === zonedNow.date && start < earliestToday);

        let status = 'available';
        if (booking) status = 'booked';
        else if (isPast) status = 'past';
        else if (wholeDayOff || rangeOff) status = 'blocked';

        slots.push({
          slotKey: `${date}T${minutesToTime(start)}`,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
          label: `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`,
          status,
          ...(booking ? { booking: { bookingId: booking.bookingId, fullName: booking.fullName, companyName: booking.companyName } } : {}),
          ...(status === 'blocked' ? { timeOffId: (rangeOff || wholeDayOff).timeOffId } : {}),
        });
      }
    }

    // Bookings that no longer fit the current hours (hours/slot length changed) stay visible
    for (const booking of dayBookings) {
      if (!slots.some((s) => s.booking?.bookingId === booking.bookingId)) {
        const start = timeToMinutes(booking.slotStartTime);
        const end = timeToMinutes(booking.slotEndTime);
        slots.push({
          slotKey: `${date}T${minutesToTime(start)}`,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
          label: `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`,
          status: 'booked',
          outsideHours: true,
          booking: { bookingId: booking.bookingId, fullName: booking.fullName, companyName: booking.companyName },
        });
      }
    }
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    result.push({
      date,
      weekday,
      dateLabel: formatDateLabel(date),
      isToday: date === zonedNow.date,
      isClosed: ranges.length === 0,
      isDayOff: Boolean(wholeDayOff),
      dayOffId: wholeDayOff?.timeOffId || null,
      dayOffReason: wholeDayOff?.timeOffReason || null,
      availableCount: slots.filter((s) => s.status === 'available').length,
      slots,
    });
  }
  return result;
}

/**
 * Customer-safe copy of the calendar: no client names, no time-off ids.
 * @param {ReturnType<typeof buildAvailability>} days
 */
export function toPublicAvailability(days) {
  return days.map((day) => ({
    date: day.date,
    dateLabel: day.dateLabel,
    isToday: day.isToday,
    isClosed: day.isClosed || day.isDayOff,
    availableCount: day.availableCount,
    slots: day.slots
      .filter((slot) => !slot.outsideHours)
      .map((slot) => ({
        slotKey: slot.slotKey,
        label: slot.label,
        status: slot.status === 'available' ? 'available' : slot.status === 'booked' ? 'booked' : 'unavailable',
      })),
  }));
}
