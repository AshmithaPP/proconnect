/**
 * Slot availability + payment return security tests (PAYMENT_MODE=worldline).
 * Usage: npm run test:payment-flow   (BASE_URL defaults to http://localhost:3000)
 *
 * Creates real hosted checkouts on the Worldline pre-production sandbox (no money moves).
 * A card payment cannot be completed from a script, so the "paid" state is written
 * straight to the DB the same way markBookingPaymentSucceeded does.
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
    `SELECT b.booking_status, p.payment_status, p.provider_order_id FROM consultation_bookings b
     JOIN booking_payments p ON p.booking_id = b.booking_id WHERE b.booking_id = ?`,
    [bookingId]
  );
  return rows[0];
}

async function markPaidInDb(bookingId, providerOrderId) {
  await db.execute(
    `UPDATE booking_payments SET payment_status = 'paid', payment_provider = 'worldline',
       provider_order_id = ?, provider_payment_id = ? WHERE booking_id = ?`,
    [providerOrderId, `TEST_PAYMENT_${Date.now()}`, bookingId]
  );
  await db.execute(`UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`, [bookingId]);
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

async function statusPageText(params) {
  const res = await fetch(`${BASE_URL}/payment-status?${new URLSearchParams(params)}`);
  return res.text();
}

async function run() {
  console.log(`\nPayment flow tests against ${BASE_URL}\n`);

  const simulatorRes = await fetch(`${BASE_URL}/mock-worldline/checkout`);
  assert(simulatorRes.status === 404, 'In-app payment simulator page no longer exists');

  const taken = await unavailableSlots();
  const slot = TIME_SLOTS.find((s) => !taken.includes(s));

  // --- Exploits ---
  const { data: victim } = await createBooking(slot);
  const victimId = victim.booking?.bookingId;
  assert(victim.paymentMode === 'worldline' && victimId, 'Booking created in worldline mode', victim);

  let location = await hitReturn({ bookingId: victimId });
  let state = await bookingState(victimId);
  assert(location.includes('status=error') && state.payment_status === 'pending',
    'Return URL with only bookingId cannot mark a booking paid', { location, state });

  location = await hitReturn({ hostedCheckoutId: `FORGED_${Date.now()}`, bookingId: victimId });
  state = await bookingState(victimId);
  assert(location.includes('unknown_checkout_session') && state.payment_status === 'pending',
    'Forged hostedCheckoutId (not issued by us) is rejected', { location, state });

  assert(!(await unavailableSlots()).includes(slot), 'Pending (unpaid) booking does NOT take the slot');

  let page = await statusPageText({ bookingId: victimId, status: 'success', paymentId: 'FAKE' });
  assert(!page.includes('Consultation Booking Confirmed') && page.includes('Payment Not Completed'),
    'Status page ignores a crafted ?status=success for an unpaid booking');

  // --- Real Worldline sandbox checkout ---
  const { status: checkoutStatus, data: checkout } = await startCheckout(victimId);
  assert(checkoutStatus === 200 && checkout.redirectUrl?.startsWith('https://payment.') && checkout.hostedCheckoutId,
    'Checkout returns a real Worldline hosted page URL', checkout);

  if (checkout.redirectUrl) {
    const hostedPage = await fetch(checkout.redirectUrl);
    assert(hostedPage.status === 200, 'Worldline hosted payment page loads', hostedPage.status);
  }

  // Customer came back without paying (session still IN_PROGRESS) → stays pending
  location = await hitReturn({ hostedCheckoutId: checkout.hostedCheckoutId });
  state = await bookingState(victimId);
  assert(location.includes('status=processing') && state.payment_status === 'pending',
    'Unpaid Worldline session → processing, booking stays pending', { location, state });
  assert(!(await unavailableSlots()).includes(slot), 'Slot still free while payment is unfinished');

  // --- Old simulator session IDs are never trusted ---
  const legacyId = `MOCK_WL_legacy_${Date.now()}`;
  await db.execute(`UPDATE booking_payments SET provider_order_id = ? WHERE booking_id = ?`, [legacyId, victimId]);
  location = await hitReturn({ hostedCheckoutId: legacyId });
  state = await bookingState(victimId);
  assert(!location.includes('status=success') && state.booking_status === 'cancelled' && state.payment_status === 'failed',
    'Legacy simulator session ID → booking cancelled, never paid', { location, state });
  assert(!(await unavailableSlots()).includes(slot), 'Cancelled booking does NOT take the slot');

  const { status: reuseStatus } = await startCheckout(victimId);
  assert(reuseStatus === 409, 'Cancelled booking cannot be sent to checkout again');

  // --- Same slot, paid this time ---
  const { status: rebookStatus, data: paidBooking } = await createBooking(slot);
  const paidId = paidBooking.booking?.bookingId;
  assert(rebookStatus === 201, 'Same slot can be booked again after cancel', paidBooking);

  const { data: rival } = await createBooking(slot);
  const rivalId = rival.booking?.bookingId;
  assert(rivalId, 'Rival pending booking allowed on same unpaid slot', rival);

  const paidCheckoutId = `TEST_PAID_${Date.now()}`;
  await markPaidInDb(paidId, paidCheckoutId);
  assert((await unavailableSlots()).includes(slot), 'Paid booking DOES take the slot');

  page = await statusPageText({ bookingId: paidId, status: 'failed' });
  assert(page.includes('Consultation Booking Confirmed'), 'Status page shows the real (paid) state from the DB');

  location = await hitReturn({ hostedCheckoutId: paidCheckoutId });
  assert(location.includes('status=success'), 'Refreshing the return URL after payment is idempotent');

  const { status: paidCheckoutStatus } = await startCheckout(paidId);
  assert(paidCheckoutStatus === 400, 'Already-paid booking cannot start another checkout');

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
