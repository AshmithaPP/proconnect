/**
 * End-to-end booking flow test.
 * Usage: npm run test:bookings  (or: node tests/e2e/bookings.test.js [baseUrl] [adminEmail] [adminPassword])
 */
const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.argv[3] || 'admin@preconnect.com';
const ADMIN_PASSWORD = process.argv[4] || 'Password@2026';
const ORIGIN = new URL(BASE_URL).origin;

let passed = 0;
let failed = 0;

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}`, detail ?? '');
    failed++;
  }
}

const validBooking = {
  fullName: 'Test Client',
  companyName: 'Acme Corp',
  workEmail: `test.client+${Date.now()}@acme.com`,
  phoneNumber: '+91 98765 43210',
  role: 'Other',
  roleOther: 'VP Growth',
  teamSize: '2–5 people',
  challenge: 'Low lead conversion',
  challengeOther: '',
  timeSlot: '10:00 AM – 10:30 AM',
};

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

async function run() {
  console.log(`\nRunning booking tests against ${BASE_URL}\n`);

  // 1. Validation rejects bad payload
  {
    const { res, data } = await post('/api/bookings', { ...validBooking, timeSlot: '3:00 AM', workEmail: 'nope' });
    assert(res.status === 400 && data.fieldErrors?.workEmail && data.fieldErrors?.timeSlot,
      'Invalid payload rejected with field errors', data);
  }

  // 2. Cross-origin rejected
  {
    const { res } = await post('/api/bookings', validBooking, { Origin: 'https://evil.example' });
    assert(res.status === 403, 'Cross-origin booking rejected with 403');
  }

  // 3. Valid booking created as pending (on a slot that is still free today)
  const slotsRes = await fetch(`${BASE_URL}/api/bookings/slots`);
  const { unavailableSlots = [] } = await slotsRes.json();
  const { TIME_SLOTS } = await import('../../src/features/booking/booking.options.js');
  const freeSlot = TIME_SLOTS.find((slot) => !unavailableSlots.includes(slot));
  const { res: createRes, data: created } = await post('/api/bookings', { ...validBooking, timeSlot: freeSlot });
  const bookingId = created.booking?.bookingId;
  assert(createRes.status === 201 && bookingId && created.booking.payment.paymentStatus === 'pending',
    'Valid booking created (201, pending payment)', created);

  // 4. Mock payment confirms it
  const { res: payRes, data: paid } = await post(`/api/bookings/${bookingId}/mock-payment`);
  assert(payRes.status === 200 && paid.booking?.payment?.paymentStatus === 'paid',
    'Mock payment marks booking paid', paid);

  // 5. Mock payment is idempotent
  const { data: paidAgain } = await post(`/api/bookings/${bookingId}/mock-payment`);
  assert(paidAgain.alreadyPaid === true, 'Repeat payment confirmation is idempotent', paidAgain);

  // 6. Admin API requires auth
  {
    const res = await fetch(`${BASE_URL}/api/admin/bookings`);
    assert(res.status === 401, 'GET /api/admin/bookings without session returns 401');
  }

  // 7. Admin sees the paid booking
  const { res: loginRes } = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  assert(loginRes.status === 200 && cookie, 'Admin login succeeds');

  {
    const res = await fetch(`${BASE_URL}/api/admin/bookings`, { headers: { Cookie: cookie } });
    const data = await res.json();
    assert(res.status === 200 && data.bookings.some((b) => b.bookingId === bookingId),
      'Paid booking appears in admin bookings API', data);
  }

  {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, { headers: { Cookie: cookie } });
    const html = await res.text();
    assert(res.status === 200 && html.includes('Paid Consultation Bookings') && html.includes(bookingId.slice(0, 8)),
      'Paid booking rendered on /admin/dashboard');
  }

  await post('/api/auth/logout', undefined, { Cookie: cookie });

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
