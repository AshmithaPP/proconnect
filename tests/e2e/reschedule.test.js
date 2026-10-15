/**
 * Phase 5 — automatic rescheduling (no admin involved) + customer "choose another time" link.
 * Usage: npm run test:reschedule   (BASE_URL defaults to http://localhost:3000)
 *
 * Runs a local SMTP server to read the real emails (and the link inside them). Booking rules,
 * SMTP settings and time off are snapshotted first and restored at the end.
 *
 * SAFETY: test bookings live on a day with no real bookings; "block everything" only blocks
 * the OPEN stretches of time (real booked slots are never inside a blocked range, so they are
 * never moved); a guard restores + fails the run if any real booking changed.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { assertTestDatabase } from './helpers/test-db.js';
import mysql from 'mysql2/promise';
import { SMTPServer } from 'smtp-server';
import { createRealDataGuard } from './helpers/real-data-guard.js';

dotenv.config({ path: '.env.local', quiet: true });
assertTestDatabase();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORIGIN = new URL(BASE_URL).origin;
const PREFIX = 'resched.test.';
const stamp = Date.now();
const PASSWORD = `Test-${crypto.randomBytes(6).toString('hex')}`;
const CONSULTANT_EMAIL = `${PREFIX}consultant.${stamp}@example.com`;
const ADMIN_EMAIL = `${PREFIX}admin.${stamp}@example.com`;
const SMTP_PORT = 2900 + Math.floor(Math.random() * 300);
const RULES = (overrides = {}) => ({
  consultationFeeRupees: 999,
  bookingWindowDays: 10,
  ...overrides,
});

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

// --- mail sink ---
const inbox = [];
const smtpServer = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  onData(stream, session, callback) {
    let raw = '';
    stream.on('data', (chunk) => (raw += chunk));
    stream.on('end', () => {
      // decode quoted-printable so links and words can be matched
      const text = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      inbox.push({ to: session.envelope.rcptTo.map((r) => r.address), text });
      callback();
    });
  },
});
await new Promise((resolve) => smtpServer.listen(SMTP_PORT, '127.0.0.1', resolve));

const waitFor = async (predicate, timeoutMs = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = predicate();
    if (found) return found;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
};
const mailTo = (address, contains) => waitFor(() => inbox.find((m) => m.to.includes(address) && (!contains || m.text.includes(contains))));
const linkIn = (mail) => mail?.text.match(/booking\/reschedule\?token=([A-Za-z0-9_-]+)/)?.[1];

// --- snapshots ---
const [settingsSnapshot] = await db.query(`SELECT setting_key, CAST(setting_value AS CHAR) v, updated_by_user_id FROM site_settings WHERE setting_key IN ('booking_rules', 'smtp')`);
const [timeOffSnapshot] = await db.query(`SELECT time_off_id FROM schedule_time_off`);
const guard = await createRealDataGuard(db);

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

async function bookingState(bookingId) {
  const [[row]] = await db.query(
    `SELECT booking_status, DATE_FORMAT(consultation_date, '%Y-%m-%d') AS d, TIME_FORMAT(slot_start_time, '%H:%i') AS t, reschedule_count
     FROM consultation_bookings WHERE booking_id = ?`,
    [bookingId]
  );
  return row;
}

async function history(bookingId) {
  const [rows] = await db.query(`SELECT reschedule_reason, rescheduled_by FROM booking_reschedules WHERE booking_id = ? ORDER BY created_at, booking_reschedule_id`, [bookingId]);
  return rows;
}

let emailCounter = 0;
async function createBooking(slotKey, name) {
  const workEmail = `${PREFIX}${name.toLowerCase()}.${stamp}.${emailCounter++}@example.com`;
  const r = await api('/api/bookings', {
    method: 'POST',
    body: { fullName: name, companyName: `${name} Co`, workEmail, phoneNumber: '+91 98765 33333', role: 'CEO / Director', teamSize: 'Just me', challenge: 'Sales team performance', slotKey },
  });
  if (r.status !== 201) console.error('createBooking failed:', slotKey, r.status, r.data);
  return { bookingId: r.data.booking?.bookingId, workEmail, status: r.status };
}

/** As if Worldline confirmed the payment and it won the slot */
async function markPaidConfirmed(bookingId) {
  await db.execute(`UPDATE booking_payments SET payment_status = 'paid', paid_at = NOW(), payment_provider = 'worldline', provider_payment_id = ? WHERE booking_id = ?`, [`TEST_${crypto.randomUUID()}`, bookingId]);
  await db.execute(`UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`, [bookingId]);
}

/** As if Worldline confirmed the payment but the slot was already confirmed for someone else */
async function markPaidCollision(bookingId) {
  await db.execute(`UPDATE booking_payments SET payment_status = 'paid', paid_at = NOW(), payment_provider = 'worldline', provider_payment_id = ? WHERE booking_id = ?`, [`TEST_${crypto.randomUUID()}`, bookingId]);
  await db.execute(`UPDATE consultation_bookings SET booking_status = 'reschedule_required', pending_reschedule_reason = 'slot_taken' WHERE booking_id = ?`, [bookingId]);
}

/** Contiguous stretches of OPEN slots in a consultant calendar day — safe to block (nothing booked inside) */
function openStretches(day) {
  const stretches = [];
  let current = null;
  for (const slot of day.slots.filter((s) => !s.outsideHours)) {
    if (slot.status === 'available') {
      if (current && current.endTime === slot.startTime) current.endTime = slot.endTime;
      else stretches.push((current = { offDate: day.date, startTime: slot.startTime, endTime: slot.endTime }));
    } else {
      current = null;
    }
  }
  return stretches;
}

async function run() {
  console.log(`\nReschedule tests against ${BASE_URL} (mail sink on ${SMTP_PORT})\n`);

  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const [email, role] of [[CONSULTANT_EMAIL, 'consultant'], [ADMIN_EMAIL, 'platform_admin']]) {
    await db.execute(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status) VALUES (?, 'Resched Tester', ?, ?, ?, 'active')`,
      [crypto.randomUUID(), email, hash, role]
    );
  }
  const consultant = await login('consultant', CONSULTANT_EMAIL);
  const admin = await login('admin', ADMIN_EMAIL);

  // 10-day window
  let r = await api('/api/consultant/schedule', { method: 'PUT', cookie: consultant, body: { rules: RULES() } });
  assert(r.status === 200, 'Test rules saved', r.data);
  r = await api('/api/admin/settings/smtp', {
    method: 'PUT', cookie: admin,
    body: { isEnabled: true, host: '127.0.0.1', port: SMTP_PORT, security: 'none', username: '', fromName: 'ProConnect', fromEmail: 'bookings@example.com', replyToEmail: '' },
  });
  assert(r.status === 200, 'Email sending pointed at the local mail sink', r.data);

  // A day with no real bookings at all
  const availability = (await api('/api/bookings/availability')).data;
  let dayA = null;
  for (const day of availability.days.slice(2)) {
    if (!(await guard.realBookingsInWindow(day.date, day.date, '00:00', '23:59'))) {
      dayA = day;
      break;
    }
  }
  if (!dayA) throw new Error('No day without real bookings in the window — refusing to run');
  const [slot10, slot11, slot12] = dayA.slots.map((s) => s.slotKey); // 10:00, 10:30, 11:00

  // --- 1. Two payments, one slot: first keeps it, second is moved to the next free slot ---
  const first = await createBooking(slot10, 'Anita');
  const second = await createBooking(slot10, 'Bharat');
  const third = await createBooking(slot10, 'Chitra');
  assert(first.status === 201 && second.status === 201 && third.status === 201, 'Three customers start booking the same slot (pending does not hold it)');
  await markPaidConfirmed(first.bookingId);
  await markPaidCollision(second.bookingId);

  r = await api('/consultant/dashboard/bookings', { cookie: consultant }); // any portal load retries waiting bookings
  let secondState = await bookingState(second.bookingId);
  assert(secondState.booking_status === 'confirmed' && secondState.d === dayA.date && secondState.t === '10:30',
    'Second payer was moved automatically to the next free slot (10:30 same day)', secondState);
  assert((await bookingState(first.bookingId)).t === '10:00', 'First payer keeps the original slot');
  let moves = await history(second.bookingId);
  assert(moves.length === 1 && moves[0].reschedule_reason === 'slot_taken' && moves[0].rescheduled_by === 'system', 'Move recorded as slot_taken by system', moves);
  assert(r.text.includes('Auto-moved'), 'Consultant bookings list shows the Auto-moved badge');

  const movedMail = await mailTo(second.workEmail, 'New time');
  assert(movedMail && movedMail.text.includes('Another client paid for your chosen time') && movedMail.text.includes('10:30 AM'),
    'Customer is emailed the new time and the reason', movedMail?.text.slice(0, 400));
  assert(await mailTo(CONSULTANT_EMAIL, 'A consultation has moved to a new time'), 'Consultant is emailed about the move');
  const firstLink = linkIn(movedMail);
  assert(firstLink, 'Email contains a "choose another time" link');

  r = await api(`/payment-status?bookingId=${second.bookingId}&status=success`);
  assert(r.text.includes('Consultation Booking Confirmed') && r.text.includes('Originally chosen') && r.text.includes('New time'),
    'Payment result page shows the confirmation with the new and original time');

  // --- 2. Three payments on one slot: each later one goes to the next still-free slot ---
  await markPaidCollision(third.bookingId);
  await api('/consultant/dashboard/bookings', { cookie: consultant }); // retries waiting bookings
  assert((await bookingState(third.bookingId)).t === '11:00', 'Third payer skips the already-filled 10:30 and gets 11:00');

  // --- 3. Consultant marks a booked slot unavailable → booking moved automatically ---
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: dayA.date, startTime: '10:00', endTime: '10:30' } });
  assert(r.status === 409 && r.data.canAutoMove && r.data.clashingBookings[0].bookingId === first.bookingId, 'Blocking a booked slot asks for confirmation first', r.data);
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: dayA.date, startTime: '10:00', endTime: '10:30', confirmMove: true } });
  const firstState = await bookingState(first.bookingId);
  assert(r.status === 201 && r.data.movedBookings[0].outcome === 'moved' && firstState.booking_status === 'confirmed' && firstState.d === dayA.date && firstState.t === '11:30',
    'Confirmed → booking moved to the next free slot (11:30 — skips 10:30 and 11:00, already taken)', { response: r.data, firstState });
  moves = await history(first.bookingId);
  assert(moves.at(-1)?.reschedule_reason === 'consultant_unavailable' && moves.at(-1)?.rescheduled_by === 'consultant', 'Recorded as consultant_unavailable');
  assert(await mailTo(first.workEmail, 'no longer available at your chosen time'), 'That customer is emailed the new time');

  // --- 4. Customer chooses another time from the link ---
  r = await api(`/booking/reschedule?token=${firstLink}`);
  assert(r.status === 200 && r.text.includes('Current booking') && r.text.includes('Pick any open time'), 'Customer link opens the change page');
  r = await api('/booking/reschedule?token=not-a-real-token-xxxxxxxxxxxx');
  assert(r.text.includes('invalid or has expired'), 'A wrong token shows "invalid or expired"');
  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: 'not-a-real-token-xxxxxxxxxxxx', slotKey: slot10 } });
  assert(r.status === 404, 'A wrong token cannot change anything');

  const later = (await api('/api/bookings/availability')).data.days.filter((d) => d.date > dayA.date);
  const openLater = later.flatMap((d) => d.slots).filter((s) => s.status === 'available').map((s) => s.slotKey);
  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: firstLink, slotKey: slot12 } });
  assert(r.status === 409, 'Customer cannot pick a slot that is already booked');
  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: firstLink, slotKey: openLater[0] } });
  secondState = await bookingState(second.bookingId);
  assert(r.status === 200 && `${secondState.d}T${secondState.t}` === openLater[0], 'Customer moved their booking to the time they chose', { response: r.data, secondState });
  assert((await history(second.bookingId)).at(-1)?.rescheduled_by === 'customer', 'Recorded as a customer change');
  assert(await mailTo(second.workEmail, 'moved to the time you chose'), 'Customer gets a confirmation of their change');
  assert((await api('/api/bookings/availability')).data.days.find((d) => d.date === dayA.date).slots.find((s) => s.slotKey === slot11).status === 'available',
    'Their old slot is free again for others');

  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: firstLink, slotKey: openLater[1] } });
  assert(r.status === 200, 'Second customer change allowed (automatic move did not count)');
  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: firstLink, slotKey: openLater[2] } });
  assert(r.status === 409 && /maximum/.test(r.data.error), 'Third customer change refused (limit 2)', r.data);

  // Cut-off (fixed: 12 hours before): put this TEST booking ~2 hours from now, then try to change it
  const soon = new Date(Date.now() + 2 * 3600000);
  const ist = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(soon).map((p) => [p.type, p.value])
  );
  await db.execute(
    `UPDATE consultation_bookings SET consultation_date = ?, slot_start_time = ?, slot_end_time = ADDTIME(?, '01:00:00') WHERE booking_id = ?`,
    [`${ist.year}-${ist.month}-${ist.day}`, `${ist.hour}:${ist.minute}:07`, `${ist.hour}:${ist.minute}:07`, third.bookingId]
  );
  const chitraMail = await mailTo(third.workEmail, 'New time');
  r = await api('/api/bookings/reschedule', { method: 'POST', body: { token: linkIn(chitraMail), slotKey: openLater[2] } });
  assert(r.status === 409 && /hours before/.test(r.data.error), 'Change refused inside the cut-off window', r.data);

  // --- 4a. Analytics counts the moves ---
  r = await api('/api/consultant/analytics?range=7', { cookie: consultant });
  assert(r.data.kpis.slotTakenMoves >= 2 && r.data.kpis.unavailableMoves >= 1 && r.data.kpis.clientChangesInRange >= 2, 'Analytics counts automatic moves and client changes', r.data.kpis);

  // --- 5. No free slot in 30 days → waits, everyone told, then booked automatically ---
  await db.execute(`DELETE FROM consultation_bookings WHERE work_email LIKE '${PREFIX}%@example.com'`); // start clean
  const lonelySlot = (await api('/api/bookings/availability')).data.days.find((d) => d.date === dayA.date).slots.find((s) => s.status === 'available').slotKey;
  const lonely = await createBooking(lonelySlot, 'Deepa');
  await markPaidConfirmed(lonely.bookingId);

  // Block every OPEN stretch of time for the next 30 days (booked slots — real or the lonely one — are never inside)
  const calendar = (await api('/api/consultant/availability?days=30', { cookie: consultant })).data;
  const blocks = [];
  for (const day of calendar.days) {
    for (const stretch of openStretches(day)) {
      const res = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: stretch });
      if (res.status !== 201) throw new Error(`Could not block an open stretch: ${JSON.stringify(res.data)}`);
      blocks.push({ ...stretch, timeOffId: res.data.timeOffId });
    }
  }
  inbox.length = 0;
  const lonelyStart = lonelySlot.split('T')[1];
  const lonelyEndMinutes = Number(lonelyStart.slice(0, 2)) * 60 + Number(lonelyStart.slice(3)) + 30;
  const lonelyEnd = `${String(Math.floor(lonelyEndMinutes / 60)).padStart(2, '0')}:${String(lonelyEndMinutes % 60).padStart(2, '0')}`;
  r = await api('/api/consultant/time-off', { method: 'POST', cookie: consultant, body: { offDate: dayA.date, startTime: lonelyStart, endTime: lonelyEnd, confirmMove: true } });
  assert(r.status === 201 && r.data.movedBookings.some((b) => b.bookingId === lonely.bookingId && b.outcome === 'pending'), 'With every slot taken or blocked, the booking waits', r.data);
  assert((await bookingState(lonely.bookingId)).booking_status === 'reschedule_required', 'Status = waiting for a free slot');
  assert(await mailTo(lonely.workEmail, 'no free slot in the coming weeks'), 'Customer told it will be booked automatically');
  assert(await mailTo(CONSULTANT_EMAIL, 'needs a new time, but no slot is free'), 'Consultant alerted to open availability');
  r = await api('/consultant/dashboard/bookings?view=reschedule', { cookie: consultant });
  assert(r.text.includes('Waiting for a free slot') && r.text.includes('Deepa'), '"Needs reschedule" tab lists it as waiting');

  const reopened = blocks.at(-1);
  r = await api(`/api/consultant/time-off/${reopened.timeOffId}`, { method: 'DELETE', cookie: consultant });
  const lonelyState = await bookingState(lonely.bookingId);
  assert(r.status === 200 && r.data.rescheduledWaitingBookings === 1 && lonelyState.booking_status === 'confirmed' &&
    lonelyState.d === reopened.offDate && lonelyState.t === reopened.startTime,
    'Reopening time books the waiting customer automatically', { response: r.data, lonelyState, reopened });
  assert(await mailTo(lonely.workEmail, 'New time'), 'And emails them the new time');
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
  await db.query(`DELETE FROM site_settings WHERE setting_key IN ('booking_rules', 'smtp')`);
  for (const row of settingsSnapshot) {
    await db.execute('INSERT INTO site_settings (setting_key, setting_value, updated_by_user_id) VALUES (?, CAST(? AS JSON), ?)', [row.setting_key, row.v, row.updated_by_user_id]);
  }
  const keepIds = timeOffSnapshot.map((row) => row.time_off_id);
  await db.query(keepIds.length ? 'DELETE FROM schedule_time_off WHERE time_off_id NOT IN (?)' : 'DELETE FROM schedule_time_off', keepIds.length ? [keepIds] : []);
  await db.execute(`DELETE FROM email_deliveries WHERE recipient_email LIKE '${PREFIX}%@example.com'`);
  await db.execute(`DELETE FROM email_deliveries WHERE booking_id IS NULL AND template_key LIKE 'booking_reschedul%' AND created_at >= NOW() - INTERVAL 1 HOUR`);
  const [bookings] = await db.execute(`DELETE FROM consultation_bookings WHERE work_email LIKE '${PREFIX}%@example.com'`);
  const [accounts] = await db.execute(`DELETE FROM portal_users WHERE email LIKE '${PREFIX}%@example.com'`);
  await db.end();
  await new Promise((resolve) => smtpServer.close(resolve));
  console.log(`\ncleanup: rules + SMTP restored, removed ${bookings.affectedRows} test bookings and ${accounts.affectedRows} accounts`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
