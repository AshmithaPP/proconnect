/**
 * Phase 3/4 — schedule: booking rules + fee, fixed business hours, time off, dated bookings,
 * consultant/admin workspace pages and analytics.
 * Usage: npm run test:schedule   (BASE_URL defaults to http://localhost:3000)
 *
 * The real booking rules and time off are snapshotted first and restored
 * at the end; test bookings and accounts are deleted.
 *
 * SAFETY: all test bookings and blocks happen on a day with no real bookings, and a guard
 * restores + fails the run if any real booking changed.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { createRealDataGuard } from './helpers/real-data-guard.js';

dotenv.config({ path: '.env.local', quiet: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORIGIN = new URL(BASE_URL).origin;
const TEST_PREFIX = 'sched.test.';
const stamp = Date.now();
const PASSWORD = `Test-${crypto.randomBytes(6).toString('hex')}`;
const CONSULTANT_EMAIL = `${TEST_PREFIX}consultant.${stamp}@example.com`;
const ADMIN_EMAIL = `${TEST_PREFIX}admin.${stamp}@example.com`;

let passed = 0;
let failed = 0;
function assert(condition, name, detail) {
  if (condition) {
    console.log(`✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${name}`, detail ?? '');
    failed++;
  }
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'preconnect_db',
});

const [rulesSnapshot] = await db.query(`SELECT CAST(setting_value AS CHAR) v, updated_by_user_id FROM site_settings WHERE setting_key = 'booking_rules'`);
const [timeOffSnapshot] = await db.query(`SELECT time_off_id FROM schedule_time_off`);
const guard = await createRealDataGuard(db);
let consultantCookie = '';

async function api(path, { method = 'GET', cookie, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { Origin: ORIGIN } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return { status: res.status, data, text };
}

async function login(portalKey, email) {
  const res = await fetch(`${BASE_URL}/api/auth/${portalKey}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

const publicAvailability = async () => (await api('/api/bookings/availability')).data;
const findSlot = (days, slotKey) => days.flatMap((d) => d.slots).find((s) => s.slotKey === slotKey);

function bookingBody(slotKey) {
  return {
    fullName: 'Schedule Tester',
    companyName: 'Sched Co',
    workEmail: `${TEST_PREFIX}${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
    phoneNumber: '+91 98765 22222',
    role: 'CEO / Director',
    teamSize: 'Just me',
    challenge: 'Sales team performance',
    slotKey,
  };
}

async function run() {
  console.log(`\nSchedule tests against ${BASE_URL}\n`);

  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const [email, role] of [[CONSULTANT_EMAIL, 'consultant'], [ADMIN_EMAIL, 'platform_admin']]) {
    await db.execute(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status) VALUES (?, 'Sched Tester', ?, ?, ?, 'active')`,
      [crypto.randomUUID(), email, hash, role]
    );
  }
  const consultant = await login('consultant', CONSULTANT_EMAIL);
  consultantCookie = consultant;
  const admin = await login('admin', ADMIN_EMAIL);

  // --- Access ---
  assert((await api('/api/consultant/schedule')).status === 401, 'Schedule API requires a session');
  assert((await api('/api/consultant/schedule', { cookie: admin })).status === 200, 'Admin can use the consultant schedule API');
  assert((await api('/api/consultant/time-off', { method: 'POST', body: { offDate: '2030-01-01' } })).status === 401, 'Time-off API requires a session');

  // --- Pages render in both portals ---
  for (const [path, cookie, marker] of [
    ['/consultant/dashboard', consultant, 'Revenue this month'],
    ['/consultant/dashboard?range=7', consultant, /class="viz-segment active"[^>]*href="\/consultant\/dashboard\?range=7"/],
    ['/consultant/dashboard/bookings', consultant, 'Needs reschedule'],
    ['/consultant/dashboard/availability', consultant, 'Availability'],
    ['/consultant/dashboard/schedule', consultant, 'Consultation length'],
    ['/admin/dashboard', admin, 'Business analytics'],
    ['/admin/dashboard/bookings', admin, 'Needs reschedule'],
    ['/admin/dashboard/availability', admin, 'Availability'],
    ['/admin/dashboard/schedule', admin, 'Consultation length'],
  ]) {
    const r = await api(path, { cookie });
    assert(r.status === 200 && (marker instanceof RegExp ? marker.test(r.text) : r.text.includes(marker)), `${path} renders`, r.status);
  }

  // --- Validation ---
  let r = await api('/api/consultant/schedule', {
    method: 'PUT', cookie: consultant,
    body: { rules: { consultationFeeRupees: 0, bookingWindowDays: 0, slotDurationMinutes: 5, customerRescheduleCutoffHours: 12, maxCustomerReschedules: 2 } },
  });
  assert(r.status === 400 && r.data.fieldErrors?.consultationFeeRupees && r.data.fieldErrors?.bookingWindowDays && r.data.fieldErrors?.slotDurationMinutes,
    'Invalid fee / window / consultation length rejected', r.data);
  r = await api('/api/consultant/schedule', { cookie: consultant });
  assert(r.data.businessHours?.length === 2 && !('minNoticeMinutes' in r.data.rules) && !('slotGapMinutes' in r.data.rules) && !('weeklyHours' in r.data),
    'Schedule API has fixed business hours and no notice / break / weekly hours', r.data);

  // --- New rules: 60-min consultations, 10-day window, ₹1,499 ---
  r = await api('/api/consultant/schedule', { method: 'PUT', cookie: consultant, body: { rules: { consultationFeeRupees: 1499, bookingWindowDays: 10, slotDurationMinutes: 60, customerRescheduleCutoffHours: 12, maxCustomerReschedules: 2 } } });
  assert(r.status === 200 && r.data.rules.consultationFeePaise === 149900, 'Rules saved (fee stored in paise)', r.data);

  let availability = await publicAvailability();
  assert(availability.days.length === 10, 'Customers now see a 10-day window', availability.days.length);
  assert(availability.fee.amountPaise === 149900 && availability.slotDurationMinutes === 60, 'Public availability shows the new fee and length');
  assert(availability.days.every((d) => !d.isClosed), 'Every day is open (no weekly closed days)');
  const home = await api('/');
  assert(home.status === 200, 'Landing page renders with the booking calendar');

  // Test bookings go on a day with no real bookings at all, so real customers are never involved
  let dayC = null;
  for (const day of availability.days.slice(1)) {
    if (!(await guard.realBookingsInWindow(day.date, day.date, '00:00', '23:59'))) {
      dayC = day;
      break;
    }
  }
  if (!dayC) throw new Error('No day without real bookings in the window — refusing to run');
  assert(dayC.slots.map((s) => s.label).join(' | ') ===
    '10:00 AM – 11:00 AM | 11:00 AM – 12:00 PM | 12:00 PM – 1:00 PM | 2:00 PM – 3:00 PM | 3:00 PM – 4:00 PM | 4:00 PM – 5:00 PM | 5:00 PM – 6:00 PM | 6:00 PM – 7:00 PM | 7:00 PM – 8:00 PM | 8:00 PM – 9:00 PM | 9:00 PM – 10:00 PM',
    '60-min slots 10 AM–10 PM, none at 1–2 PM', dayC.slots.map((s) => s.label));

  // --- Booking uses the consultant's fee ---
  const slotA = dayC.slots[0].slotKey;
  r = await api('/api/bookings', { method: 'POST', body: bookingBody(slotA) });
  assert(r.status === 201 && r.data.booking.payment.amountPaise === 149900 && r.data.booking.consultationDate === dayC.date,
    'New booking is dated and charged the consultant fee', r.data);

  // --- Block one slot ---
  const slotB = dayC.slots[1]; // 11:00–12:00
  r = await api('/api/consultant/time-off', {
    method: 'POST', cookie: consultant,
    body: { offDate: dayC.date, startTime: '11:00', endTime: '12:00', timeOffReason: 'Dentist' },
  });
  assert(r.status === 201 && r.data.timeOffId, 'Consultant blocks one slot', r.data);
  const slotOffId = r.data.timeOffId;
  availability = await publicAvailability();
  assert(findSlot(availability.days, slotB.slotKey).status === 'unavailable', 'Blocked slot is unavailable to customers');
  assert(!JSON.stringify(availability).includes('Dentist'), 'Private block reason is not exposed publicly');
  r = await api('/api/bookings', { method: 'POST', body: bookingBody(slotB.slotKey) });
  assert(r.status === 409, 'Booking a blocked slot is rejected (409)', r.data);
  r = await api('/api/consultant/availability?days=10', { cookie: consultant });
  const consultantSlot = r.data.days.find((d) => d.date === dayC.date).slots.find((s) => s.slotKey === slotB.slotKey);
  assert(consultantSlot.status === 'blocked' && consultantSlot.timeOffId === slotOffId, 'Consultant calendar shows the block with its id');
  r = await api(`/api/consultant/time-off/${slotOffId}`, { method: 'DELETE', cookie: consultant });
  assert(r.status === 200 && findSlot((await publicAvailability()).days, slotB.slotKey).status === 'available', 'Unblocking reopens the slot');

  // --- Block a whole day (as admin) ---
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: admin, body: { offDate: dayC.date } });
  assert(r.status === 201, 'Admin marks a whole day unavailable');
  const dayOffId = r.data.timeOffId;
  availability = await publicAvailability();
  const blockedDay = availability.days.find((d) => d.date === dayC.date);
  assert(blockedDay.isClosed && blockedDay.availableCount === 0, 'Whole day shows as closed to customers');
  await api(`/api/consultant/time-off/${dayOffId}`, { method: 'DELETE', cookie: admin });
  assert((await publicAvailability()).days.find((d) => d.date === dayC.date).availableCount === 11, 'Day reopened (11 slots)');

  // --- A paid booking is never dropped by blocking ---
  const paidSlot = dayC.slots[2].slotKey; // 12:00–13:00
  r = await api('/api/bookings', { method: 'POST', body: bookingBody(paidSlot) });
  const paidBookingId = r.data.booking?.bookingId;
  await db.execute(`UPDATE booking_payments SET payment_status = 'paid', paid_at = NOW(), provider_payment_id = ? WHERE booking_id = ?`, [`TEST_${stamp}`, paidBookingId]);
  await db.execute(`UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`, [paidBookingId]);
  assert(findSlot((await publicAvailability()).days, paidSlot).status === 'booked', 'Paid booking shows as booked');
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: dayC.date } });
  assert(r.status === 409 && r.data.canAutoMove && r.data.clashingBookings?.[0]?.bookingId === paidBookingId, 'Whole-day block asks before moving a paid booking', r.data);
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: dayC.date, startTime: '12:00', endTime: '13:00' } });
  assert(r.status === 409, 'Blocking the booked slot asks first too');
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: '2020-01-01' } });
  assert(r.status === 400, 'Past dates cannot be blocked');

  // --- Changing the consultation length keeps existing bookings ---
  r = await api('/api/consultant/schedule', { method: 'PUT', cookie: consultant, body: { rules: { consultationFeeRupees: 1499, bookingWindowDays: 10, slotDurationMinutes: 45, customerRescheduleCutoffHours: 12, maxCustomerReschedules: 2 } } });
  assert(r.status === 200, 'Consultation length changed to 45 minutes');
  r = await api('/api/consultant/availability?days=10', { cookie: consultant });
  const kept = r.data.days.flatMap((d) => d.slots).find((s) => s.booking?.bookingId === paidBookingId);
  assert(kept?.status === 'booked', 'The paid booking is kept and still shown as booked');

  // --- Bookings views + analytics ---
  r = await api('/api/consultant/bookings?view=upcoming', { cookie: consultant });
  assert(r.status === 200 && r.data.bookings.some((b) => b.bookingId === paidBookingId && b.consultationDate === dayC.date), 'Paid booking is listed under Upcoming with its date');
  r = await api(`/api/consultant/bookings?view=upcoming&q=${encodeURIComponent('Sched Co')}`, { cookie: consultant });
  assert(r.data.bookings.length >= 1 && r.data.bookings.every((b) => b.companyName === 'Sched Co'), 'Search filters bookings');
  r = await api('/consultant/dashboard/bookings?view=upcoming', { cookie: consultant });
  assert(r.text.includes('Schedule Tester'), 'Bookings page lists the booking');
  r = await api('/api/consultant/analytics?range=7', { cookie: consultant });
  assert(r.status === 200 && r.data.dailyRevenue.length === 7 && r.data.funnel.length === 3 && r.data.heatmap.rows.length === 7,
    'Analytics API returns 7 days of revenue, the funnel and the heatmap');
  assert(r.data.upcoming.some((u) => u.bookingId === paidBookingId), 'Analytics upcoming week includes the paid booking');
  assert((await api('/api/consultant/analytics')).status === 401, 'Analytics requires a session');
}

try {
  await run();
} catch (err) {
  console.error('Test run crashed:', err);
  failed++;
} finally {
  const changedReal = await guard.verifyAndRestore();
  if (changedReal.length) {
    console.error(`✗ FAIL: test changed ${changedReal.length} REAL booking(s) — restored:`, changedReal);
    failed++;
  } else {
    console.log(`✓ PASS: none of the ${guard.realBookingCount} real bookings was touched`);
    passed++;
  }
  // Restore the real booking rules exactly
  await db.query(`DELETE FROM site_settings WHERE setting_key = 'booking_rules'`);
  for (const row of rulesSnapshot) {
    await db.execute(`INSERT INTO site_settings (setting_key, setting_value, updated_by_user_id) VALUES ('booking_rules', CAST(? AS JSON), ?)`, [row.v, row.updated_by_user_id]);
  }
  const keepIds = timeOffSnapshot.map((r) => r.time_off_id);
  await db.query(keepIds.length ? `DELETE FROM schedule_time_off WHERE time_off_id NOT IN (?)` : 'DELETE FROM schedule_time_off', keepIds.length ? [keepIds] : []);
  const [bookings] = await db.execute(`DELETE FROM consultation_bookings WHERE work_email LIKE '${TEST_PREFIX}%@example.com'`);
  const [accounts] = await db.execute(`DELETE FROM portal_users WHERE email LIKE '${TEST_PREFIX}%@example.com'`);
  await db.end();
  console.log(`\ncleanup: schedule restored, removed ${bookings.affectedRows} test bookings and ${accounts.affectedRows} accounts`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
