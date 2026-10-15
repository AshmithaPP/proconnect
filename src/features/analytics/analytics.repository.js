import 'server-only';
import { query } from '@/lib/db';
import { getBusinessTimezone, loadAvailability } from '@/features/schedule/schedule.repository';
import { getBookingViewCounts } from '@/features/booking/booking.repository';
import { addDays, getZonedNow, weekdayOf, timeToMinutes, formatSlotLabel, formatDateLabel } from '@/features/schedule/slot-engine';

export const ANALYTICS_RANGES = [7, 30, 90];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** First day of the month before `date` ("2026-10-15" → "2026-09-01") */
function previousMonthStart(date) {
  const [year, month] = date.split('-').map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return prev.toISOString().slice(0, 10);
}

/** Percentage change, null when there is no baseline */
function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Count values, biggest first; anything past `limit` folds into "Other" */
function breakdown(values, limit = 6) {
  const counts = new Map();
  for (const value of values) {
    const key = value || 'Not specified';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const otherCount = sorted.slice(limit - 1).reduce((sum, item) => sum + item.count, 0);
  return [...head, { label: 'Other', count: otherCount }];
}

/**
 * Everything the consultant dashboard shows, for the last `rangeDays` days.
 * Timestamps (paid_at, created_at) are converted to the business timezone in code, so the
 * numbers never depend on the MySQL server's time zone.
 *
 * @param {{ rangeDays: number }} params
 */
export async function getConsultantAnalytics({ rangeDays }) {
  const timezone = await getBusinessTimezone();
  const now = getZonedNow(timezone);
  const today = now.date;
  const rangeStart = addDays(today, -(rangeDays - 1));
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthStart = previousMonthStart(today);
  // Same day-of-month last month, capped at last month's final day (e.g. 31 Oct → 30 Sep)
  const lastMonthEnd = addDays(monthStart, -1);
  const sameDayLastMonth = addDays(lastMonthStart, Number(today.slice(8, 10)) - 1);
  const lastMonthSameDay = sameDayLastMonth < lastMonthEnd ? sameDayLastMonth : lastMonthEnd;
  const fetchFrom = rangeStart < lastMonthStart ? rangeStart : lastMonthStart;
  // One extra day either side of the timezone shift; exact filtering happens in code
  const fetchFromInstant = new Date(new Date(`${fetchFrom}T00:00:00Z`).getTime() - ONE_DAY_MS);
  const toBusinessDate = (instant) => getZonedNow(timezone, new Date(instant)).date;

  const [paidRows, createdRows, totalRows, upcomingRows, availability, viewCounts] = await Promise.all([
    query(
      `SELECT p.amount_paise, p.paid_at, b.booking_status, b.user_role, b.sales_team_size, b.sales_challenge,
              DATE_FORMAT(b.consultation_date, '%Y-%m-%d') AS consultation_date, TIME_FORMAT(b.slot_start_time, '%H:%i') AS slot_start_time
       FROM booking_payments p
       JOIN consultation_bookings b ON b.booking_id = p.booking_id
       WHERE p.payment_status = 'paid' AND p.paid_at >= ?`,
      [fetchFromInstant]
    ),
    query(
      `SELECT b.created_at,
              EXISTS (SELECT 1 FROM booking_payments s WHERE s.booking_id = b.booking_id AND s.provider_order_id IS NOT NULL) AS checkout_started,
              EXISTS (SELECT 1 FROM booking_payments s WHERE s.booking_id = b.booking_id AND s.payment_status = 'paid') AS is_paid
       FROM consultation_bookings b
       WHERE b.created_at >= ?`,
      [new Date(new Date(`${rangeStart}T00:00:00Z`).getTime() - ONE_DAY_MS)]
    ),
    query(`SELECT COUNT(*) AS paid_count, COALESCE(SUM(amount_paise), 0) AS revenue_paise FROM booking_payments WHERE payment_status = 'paid'`),
    query(
      `SELECT booking_id, full_name, company_name, phone_number,
              DATE_FORMAT(consultation_date, '%Y-%m-%d') AS consultation_date,
              TIME_FORMAT(slot_start_time, '%H:%i') AS slot_start_time, TIME_FORMAT(slot_end_time, '%H:%i') AS slot_end_time
       FROM consultation_bookings
       WHERE booking_status = 'confirmed' AND consultation_date BETWEEN ? AND ?
       ORDER BY consultation_date, slot_start_time`,
      [today, addDays(today, 6)]
    ),
    loadAvailability(),
    getBookingViewCounts(today),
  ]);

  const paid = paidRows.map((row) => ({ ...row, paidDate: toBusinessDate(row.paid_at), amount: Number(row.amount_paise) }));
  const inRange = paid.filter((p) => p.paidDate >= rangeStart && p.paidDate <= today);
  const thisMonth = paid.filter((p) => p.paidDate >= monthStart && p.paidDate <= today);
  // Same number of days into last month, for a fair month-to-date comparison
  const lastMonthToDate = paid.filter((p) => p.paidDate >= lastMonthStart && p.paidDate <= lastMonthSameDay);
  const sum = (rows) => rows.reduce((total, row) => total + row.amount, 0);

  // Revenue per day over the range
  const revenueByDay = new Map();
  for (const row of inRange) revenueByDay.set(row.paidDate, (revenueByDay.get(row.paidDate) || 0) + row.amount);
  const bookingsByDay = new Map();
  for (const row of inRange) bookingsByDay.set(row.paidDate, (bookingsByDay.get(row.paidDate) || 0) + 1);
  const dailyRevenue = Array.from({ length: rangeDays }, (_, index) => {
    const date = addDays(rangeStart, index);
    return { date, label: formatDateLabel(date, { withYear: false }), revenuePaise: revenueByDay.get(date) || 0, bookings: bookingsByDay.get(date) || 0 };
  });

  // Consultation times: weekday × hour, for bookings paid in the range
  const heatmapCells = new Map();
  const hours = new Set(availability.weeklyHours.flatMap((h) => {
    const list = [];
    for (let m = timeToMinutes(h.startTime); m < timeToMinutes(h.endTime); m += 60) list.push(Math.floor(m / 60));
    return list;
  }));
  for (const row of inRange) {
    if (!row.consultation_date || !row.slot_start_time) continue;
    const hour = Math.floor(timeToMinutes(row.slot_start_time) / 60);
    hours.add(hour);
    const key = `${weekdayOf(row.consultation_date)}-${hour}`;
    heatmapCells.set(key, (heatmapCells.get(key) || 0) + 1);
  }
  const heatmapHours = [...hours].sort((a, b) => a - b);
  const heatmap = {
    hours: heatmapHours,
    // Monday first
    rows: [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
      weekday,
      cells: heatmapHours.map((hour) => ({ hour, count: heatmapCells.get(`${weekday}-${hour}`) || 0 })),
    })),
  };

  // Funnel: bookings submitted in the range
  const created = createdRows.filter((row) => toBusinessDate(row.created_at) >= rangeStart);
  const submitted = created.length;
  const checkoutStarted = created.filter((row) => Number(row.checkout_started)).length;
  const paidFromRange = created.filter((row) => Number(row.is_paid)).length;

  // Booking window utilisation (upcoming slots only)
  const windowSlots = availability.days.flatMap((d) => d.slots).filter((s) => !s.outsideHours);
  const bookedSlots = windowSlots.filter((s) => s.status === 'booked').length;
  const openSlots = windowSlots.filter((s) => s.status === 'available').length;

  const upcoming = upcomingRows
    .filter((row) => row.consultation_date > today || timeToMinutes(row.slot_end_time) > now.minutes)
    .map((row) => ({
      bookingId: row.booking_id,
      fullName: row.full_name,
      companyName: row.company_name,
      phoneNumber: row.phone_number,
      consultationDate: row.consultation_date,
      dateLabel: row.consultation_date === today ? 'Today' : formatDateLabel(row.consultation_date, { withYear: false }),
      slotLabel: formatSlotLabel(row.slot_start_time, row.slot_end_time),
      isToday: row.consultation_date === today,
    }));

  return {
    timezone,
    today,
    rangeDays,
    rangeStart,
    kpis: {
      revenueThisMonthPaise: sum(thisMonth),
      revenueChangePercent: percentChange(sum(thisMonth), sum(lastMonthToDate)),
      bookingsThisMonth: thisMonth.length,
      bookingsChangePercent: percentChange(thisMonth.length, lastMonthToDate.length),
      revenueInRangePaise: sum(inRange),
      bookingsInRange: inRange.length,
      averageBookingValuePaise: inRange.length ? Math.round(sum(inRange) / inRange.length) : 0,
      todayCount: upcomingRows.filter((row) => row.consultation_date === today).length,
      nextConsultation: upcoming[0] || null,
      upcomingWeekCount: upcomingRows.length,
      utilisationPercent: bookedSlots + openSlots ? Math.round((bookedSlots / (bookedSlots + openSlots)) * 100) : null,
      bookedSlots,
      openSlots,
      conversionPercent: submitted ? Math.round((paidFromRange / submitted) * 100) : null,
      rescheduleCount: viewCounts.reschedule,
      allTimeRevenuePaise: Number(totalRows[0].revenue_paise),
      allTimeBookings: Number(totalRows[0].paid_count),
    },
    dailyRevenue,
    heatmap,
    funnel: [
      { stage: 'Form submitted', count: submitted },
      { stage: 'Went to payment', count: checkoutStarted },
      { stage: 'Paid', count: paidFromRange },
    ],
    breakdowns: {
      salesChallenge: breakdown(inRange.map((p) => p.sales_challenge)),
      userRole: breakdown(inRange.map((p) => p.user_role)),
      teamSize: breakdown(inRange.map((p) => p.sales_team_size)),
    },
    upcoming,
  };
}
