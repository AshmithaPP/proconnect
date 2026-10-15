/**
 * End-to-end booking flow test.
 * Usage: npm run test:bookings  (or: node tests/e2e/bookings.test.js [baseUrl])
 * Signs in to the consultant portal with a temporary consultant account (deleted at the end).
 */
const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const CONSULTANT_EMAIL = `portal.test.bookings.${Date.now()}@example.com`;
const CONSULTANT_PASSWORD = `Test-${Date.now()}-pw`;
const ORIGIN = new URL(BASE_URL).origin;
const TEST_EMAIL_DOMAIN = '@acme.com';

const { default: dotenv } = await import('dotenv');
const { default: mysql } = await import('mysql2/promise');
const { default: bcrypt } = await import('bcryptjs');
const { randomUUID } = await import('crypto');
dotenv.config({ path: '.env.local', quiet: true });
const { assertTestDatabase } = await import('./helpers/test-db.js');
assertTestDatabase();
const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'preconnect_db',
});

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
  slotKey: '',
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
    const { res, data } = await post('/api/bookings', { ...validBooking, slotKey: '3:00 AM', workEmail: 'nope' });
    assert(res.status === 400 && data.fieldErrors?.workEmail && data.fieldErrors?.slotKey,
      'Invalid payload rejected with field errors', data);
  }

  // 2. Cross-origin rejected
  {
    const { res } = await post('/api/bookings', validBooking, { Origin: 'https://evil.example' });
    assert(res.status === 403, 'Cross-origin booking rejected with 403');
  }

  // 3. Valid booking created as pending (on the first open slot in the booking window)
  const availabilityRes = await fetch(`${BASE_URL}/api/bookings/availability`);
  const { days = [] } = await availabilityRes.json();
  const freeSlot = days.flatMap((d) => d.slots).find((s) => s.status === 'available')?.slotKey;
  const { res: createRes, data: created } = await post('/api/bookings', { ...validBooking, slotKey: freeSlot });
  const bookingId = created.booking?.bookingId;
  assert(createRes.status === 201 && bookingId && created.booking.payment.paymentStatus === 'pending',
    'Valid booking created (201, pending payment)', created);

  // 4. Payment happens on Worldline's hosted page, which a script cannot fill in —
  //    record the paid state directly, as the Worldline return route would
  await db.execute(
    `UPDATE booking_payments SET payment_status = 'paid', payment_provider = 'worldline',
       provider_order_id = ?, provider_payment_id = ? WHERE booking_id = ?`,
    [`TEST_PAID_${Date.now()}`, `TEST_PAYMENT_${Date.now()}`, bookingId]
  );
  await db.execute(`UPDATE consultation_bookings SET booking_status = 'confirmed' WHERE booking_id = ?`, [bookingId]);

  // 5. Paid booking now blocks the slot
  {
    const res = await fetch(`${BASE_URL}/api/bookings/availability`);
    const { days: after = [] } = await res.json();
    const nowSlot = after.flatMap((d) => d.slots).find((s) => s.slotKey === freeSlot);
    assert(nowSlot?.status === 'booked', 'Paid booking takes the slot', nowSlot);
  }

  // 6. Admin API requires auth
  {
    const res = await fetch(`${BASE_URL}/api/consultant/bookings`);
    assert(res.status === 401, 'GET /api/consultant/bookings without session returns 401');
  }

  // 7. Admin sees the paid booking
  await db.execute(
    `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status)
     VALUES (?, 'Test Consultant', ?, ?, 'consultant', 'active')`,
    [randomUUID(), CONSULTANT_EMAIL, await bcrypt.hash(CONSULTANT_PASSWORD, 10)]
  );
  const { res: loginRes } = await post('/api/auth/consultant/login', { email: CONSULTANT_EMAIL, password: CONSULTANT_PASSWORD });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  assert(loginRes.status === 200 && cookie, 'Consultant login succeeds');

  {
    const res = await fetch(`${BASE_URL}/api/consultant/bookings`, { headers: { Cookie: cookie } });
    const data = await res.json();
    assert(res.status === 200 && data.bookings.some((b) => b.bookingId === bookingId),
      'Paid booking appears in consultant bookings API', data);
    assert(data.bookings.every((b) => b.status === 'paid'),
      'Consultant bookings API returns only paid bookings', data.bookings.map((b) => b.status));
  }

  {
    const res = await fetch(`${BASE_URL}/consultant/dashboard/bookings`, { headers: { Cookie: cookie } });
    const html = await res.text();
    assert(res.status === 200 && html.includes('Needs reschedule') && html.includes(bookingId.slice(0, 8)),
      'Paid booking rendered on /consultant/dashboard/bookings');
  }

  await post('/api/auth/consultant/logout', undefined, { Cookie: cookie });
}

try {
  await run();
} catch (err) {
  console.error('Test run crashed:', err);
  failed++;
} finally {
  const [result] = await db.execute(
    `DELETE FROM consultation_bookings WHERE work_email LIKE 'test.client+%${TEST_EMAIL_DOMAIN}'`
  );
  await db.execute(`DELETE FROM portal_users WHERE email = ?`, [CONSULTANT_EMAIL]);
  await db.end();
  console.log(`\ncleanup: removed ${result.affectedRows} test bookings`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
