/**
 * Slot availability + payment return security tests.
 * Usage: npm run test:payment-flow   (BASE_URL defaults to http://localhost:3000)
 *
 * Detects the gateway mode from the server:
 *  - WORLDLINE_ENV=mock  → full simulator flow (cancel frees slot, pay takes slot, double-book blocked)
 *  - any other env       → simulator must be locked down (no fake payments possible)
 * Never calls the real Worldline API.
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { TIME_SLOTS } from '../../src/features/booking/booking.options.js';

dotenv.config({ path: '.env.local', quiet: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORIGIN = new URL(BASE_URL).origin;
const TEST_EMAIL_PREFIX = 'flow.test.';

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

async function bookingState(bookingId) {
  const [rows] = await db.execute(
    `SELECT b.booking_status, p.payment_status FROM consultation_bookings b
     JOIN booking_payments p ON p.booking_id = b.booking_id WHERE b.booking_id = ?`,
    [bookingId]
  );
  return rows[0];
}

async function unavailableSlots() {
  const res = await fetch(`${BASE_URL}/api/bookings/slots`);
  return (await res.json()).unavailableSlots || [];
}

async function createBooking(timeSlot) {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      fullName: 'Flow Tester',
      companyName: 'Flow Co',
      workEmail: `${TEST_EMAIL_PREFIX}${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`,
      phoneNumber: '+91 98765 11111',
      role: 'CEO / Director',
      teamSize: 'Just me',
      challenge: 'Sales team performance',
      timeSlot,
    }),
  });
  return { status: res.status, data: await res.json() };
}

async function startCheckout(bookingId) {
  const res = await fetch(`${BASE_URL}/api/payments/worldline/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ bookingId }),
  });
  return { status: res.status, data: await res.json() };
}

async function hitReturn(params) {
  const res = await fetch(`${BASE_URL}/api/payments/worldline/return?${new URLSearchParams(params)}`, {
    redirect: 'manual',
  });
  return res.headers.get('location') || '';
}

async function run() {
  const simulatorRes = await fetch(`${BASE_URL}/mock-worldline/checkout`);
  const mockMode = simulatorRes.status === 200;
  console.log(`\nPayment flow tests against ${BASE_URL} (simulator ${mockMode ? 'ENABLED' : 'DISABLED'})\n`);

  const taken = await unavailableSlots();
  const slot = TIME_SLOTS.find((s) => !taken.includes(s));

  // --- Exploits that must fail in every mode ---
  const { data: victim } = await createBooking(slot);
  const victimId = victim.booking?.bookingId;
  assert(victimId, 'Booking created for exploit checks', victim);

  let location = await hitReturn({ bookingId: victimId });
  let state = await bookingState(victimId);
  assert(location.includes('status=error') && state.payment_status === 'pending',
    'Return URL with only bookingId cannot mark a booking paid', { location, state });

  location = await hitReturn({ hostedCheckoutId: `MOCK_WL_${Date.now()}`, bookingId: victimId });
  state = await bookingState(victimId);
  assert(location.includes('unknown_checkout_session') && state.payment_status === 'pending',
    'Forged hostedCheckoutId (not issued by us) is rejected', { location, state });

  assert(!(await unavailableSlots()).includes(slot), 'Pending (unpaid) booking does NOT take the slot');

  if (!mockMode) {
    assert(simulatorRes.status === 404, 'Simulator page returns 404 when WORLDLINE_ENV is not mock');

    // A booking that somehow carries a simulator session ID must not be confirmed
    const forgedId = `MOCK_WL_forged_${Date.now()}`;
    await db.execute(
      `UPDATE booking_payments SET provider_order_id = ?, payment_provider = 'worldline' WHERE booking_id = ?`,
      [forgedId, victimId]
    );
    location = await hitReturn({ hostedCheckoutId: forgedId, action: 'cancel' });
    state = await bookingState(victimId);
    assert(!location.includes('status=success') && state.payment_status !== 'paid',
      'Simulator session ID is not trusted when simulator is disabled', { location, state });
    assert(!(await unavailableSlots()).includes(slot), 'Slot stays free after rejected simulator session');
    return;
  }

  // --- Simulator flow: your exact scenario (book → checkout → Simulate User Cancel) ---
  const { data: cancelCheckout } = await startCheckout(victimId);
  assert(cancelCheckout.hostedCheckoutId?.startsWith('MOCK_WL_'), 'Checkout session created', cancelCheckout);

  location = await hitReturn({ hostedCheckoutId: cancelCheckout.hostedCheckoutId, bookingId: victimId, action: 'cancel' });
  state = await bookingState(victimId);
  assert(location.includes('status=cancelled') && state.booking_status === 'cancelled' && state.payment_status === 'failed',
    'Simulate User Cancel → booking cancelled, payment failed', { location, state });
  assert(!(await unavailableSlots()).includes(slot), 'Cancelled booking does NOT take the slot');

  const { status: reuseStatus } = await startCheckout(victimId);
  assert(reuseStatus === 409, 'Cancelled booking cannot be sent to checkout again');

  // --- Same slot, paid this time ---
  const { status: rebookStatus, data: paidBooking } = await createBooking(slot);
  const paidId = paidBooking.booking?.bookingId;
  assert(rebookStatus === 201, 'Same slot can be booked again after cancel', paidBooking);

  // A rival also starts booking the same slot before anyone pays
  const { data: rival } = await createBooking(slot);
  const rivalId = rival.booking?.bookingId;
  assert(rivalId, 'Rival pending booking allowed on same unpaid slot', rival);

  const { data: paidCheckout } = await startCheckout(paidId);
  location = await hitReturn({ hostedCheckoutId: paidCheckout.hostedCheckoutId, bookingId: paidId });
  state = await bookingState(paidId);
  assert(location.includes('status=success') && state.booking_status === 'confirmed' && state.payment_status === 'paid',
    'Successful payment confirms booking', { location, state });
  assert((await unavailableSlots()).includes(slot), 'Paid booking DOES take the slot');

  location = await hitReturn({ hostedCheckoutId: paidCheckout.hostedCheckoutId });
  assert(location.includes('status=success'), 'Refreshing the return URL after payment is idempotent');

  const { status: rivalCheckoutStatus } = await startCheckout(rivalId);
  state = await bookingState(rivalId);
  assert(rivalCheckoutStatus === 409 && state.booking_status === 'cancelled',
    'Rival cannot pay for a slot that was just paid', { rivalCheckoutStatus, state });

  const { status: thirdStatus } = await createBooking(slot);
  assert(thirdStatus === 409, 'New booking on a paid slot is rejected (409)');
}

try {
  await run();
} catch (err) {
  console.error('Test run crashed:', err);
  failed++;
} finally {
  const [result] = await db.execute(
    `DELETE FROM consultation_bookings WHERE work_email LIKE '${TEST_EMAIL_PREFIX}%@example.com'`
  );
  await db.end();
  console.log(`\ncleanup: removed ${result.affectedRows} test bookings`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
