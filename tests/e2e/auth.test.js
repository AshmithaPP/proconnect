/**
 * Portal authentication tests: admin (platform_admin) and consultant portals.
 * Usage: npm run test:auth   (BASE_URL defaults to http://localhost:3000)
 *
 * Creates two temporary accounts (one per role) directly in MySQL and deletes them at the end.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { assertTestDatabase } from './helpers/test-db.js';
import mysql from 'mysql2/promise';
import { sanitizeReturnTo } from '../../src/features/auth/auth.schema.js';

dotenv.config({ path: '.env.local', quiet: true });
assertTestDatabase();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORIGIN = new URL(BASE_URL).origin;
const TEST_EMAIL_PREFIX = 'portal.test.';
const PASSWORD = `Test-${crypto.randomBytes(6).toString('hex')}`;
const stamp = Date.now();
const ACCOUNTS = {
  admin: { email: `${TEST_EMAIL_PREFIX}admin.${stamp}@example.com`, fullName: 'Test Platform Admin', userRole: 'platform_admin' },
  consultant: { email: `${TEST_EMAIL_PREFIX}consultant.${stamp}@example.com`, fullName: 'Test Consultant', userRole: 'consultant' },
};

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

async function login(portalKey, email, password = PASSWORD, headers = {}) {
  const res = await fetch(`${BASE_URL}/api/auth/${portalKey}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

const get = (path, cookie, extra = {}) =>
  fetch(`${BASE_URL}${path}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual', ...extra });

/** Re-label a session cookie as the other portal's cookie (token swap attack) */
const asCookie = (cookie, cookieName) => `${cookieName}=${cookie.split('=')[1]}`;

async function run() {
  console.log(`\nPortal auth tests against ${BASE_URL}\n`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const account of Object.values(ACCOUNTS)) {
    await db.execute(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [crypto.randomUUID(), account.fullName, account.email, passwordHash, account.userRole]
    );
  }

  // --- Logged-out access ---
  for (const portalKey of ['admin', 'consultant']) {
    let res = await get(`/${portalKey}/dashboard`);
    assert([302, 307, 308].includes(res.status) && res.headers.get('location')?.includes(`/${portalKey}/login`),
      `Logged-out /${portalKey}/dashboard redirects to /${portalKey}/login`, res.headers.get('location'));

    res = await get(`/${portalKey}/login`);
    const html = await res.text();
    assert(res.status === 200 && html.includes('Sign In to ProConnect'), `/${portalKey}/login renders`);
  }

  let res = await get('/consultant', null);
  assert(res.headers.get('location')?.includes('/consultant/dashboard'), '/consultant redirects to its dashboard');

  res = await fetch(`${BASE_URL}/api/auth/unknown/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: '{}',
  });
  assert(res.status === 404, 'Unknown portal in /api/auth/{portal}/login returns 404');

  // --- Login rules ---
  let result = await login('admin', ACCOUNTS.admin.email, 'WrongPassword123');
  assert(result.res.status === 401 && result.data.error === 'Invalid email or password', 'Wrong password → 401 generic error');

  result = await login('admin', ACCOUNTS.consultant.email);
  assert(result.res.status === 401 && result.data.error === 'Invalid email or password' && !result.cookie,
    'Consultant account cannot sign in to the admin portal (same generic error)');

  result = await login('consultant', ACCOUNTS.admin.email);
  assert(result.res.status === 401 && !result.cookie, 'Admin account cannot sign in to the consultant portal');

  result = await login('consultant', ACCOUNTS.consultant.email, PASSWORD, { Origin: 'https://attacker-website.com' });
  assert(result.res.status === 403, 'Cross-origin login rejected with 403');

  const admin = await login('admin', ACCOUNTS.admin.email);
  assert(admin.res.status === 200 && admin.cookie.startsWith('admin_session=') && admin.data.redirectTo === '/admin/dashboard',
    'Admin login sets admin_session cookie', admin.data);

  const consultant = await login('consultant', ACCOUNTS.consultant.email);
  assert(consultant.res.status === 200 && consultant.cookie.startsWith('consultant_session=') &&
    consultant.data.redirectTo === '/consultant/dashboard', 'Consultant login sets consultant_session cookie', consultant.data);

  // --- Each portal works with its own session ---
  res = await get('/api/auth/admin/me', admin.cookie);
  let data = await res.json();
  assert(res.status === 200 && data.user.userRole === 'platform_admin' && data.user.email === ACCOUNTS.admin.email,
    'GET /api/auth/admin/me returns the admin', data);

  res = await get('/api/auth/consultant/me', consultant.cookie);
  data = await res.json();
  assert(res.status === 200 && data.user.userRole === 'consultant', 'GET /api/auth/consultant/me returns the consultant', data);

  res = await get('/admin/dashboard', admin.cookie);
  let html = await res.text();
  assert(res.status === 200 && html.includes('Consultant') && html.includes('Business analytics'),
    'Admin dashboard renders platform status and business analytics');

  res = await get('/consultant/dashboard', consultant.cookie);
  html = await res.text();
  assert(res.status === 200 && html.includes('Welcome back') && html.includes('Test Consultant'),
    'Consultant dashboard renders the analytics overview');

  res = await get('/api/consultant/bookings', consultant.cookie);
  assert(res.status === 200, 'Consultant can read /api/consultant/bookings');

  // --- Roles never cross ---
  res = await get('/api/consultant/bookings', admin.cookie);
  assert(res.status === 200, 'Admin session can read the shared bookings API (admin has every consultant feature)');

  res = await get('/api/consultant/bookings', asCookie(admin.cookie, 'consultant_session'));
  assert(res.status === 401, 'Admin token relabelled as consultant_session is rejected by the API');

  res = await get('/consultant/dashboard', asCookie(admin.cookie, 'consultant_session'));
  assert([302, 307, 308].includes(res.status) && res.headers.get('location')?.includes('/consultant/login'),
    'Admin token relabelled as consultant_session cannot open the consultant dashboard');

  res = await get('/admin/dashboard', asCookie(consultant.cookie, 'admin_session'));
  assert([302, 307, 308].includes(res.status) && res.headers.get('location')?.includes('/admin/login'),
    'Consultant token relabelled as admin_session cannot open the admin dashboard');

  res = await get('/api/auth/admin/me', asCookie(consultant.cookie, 'admin_session'));
  assert(res.status === 401, 'Consultant token relabelled as admin_session is rejected by /api/auth/admin/me');

  // --- Logout ends only that portal's session ---
  res = await fetch(`${BASE_URL}/api/auth/admin/logout`, { method: 'POST', headers: { Cookie: admin.cookie, Origin: ORIGIN } });
  assert(res.status === 200, 'Admin logout succeeds');

  res = await get('/api/auth/admin/me', admin.cookie);
  assert(res.status === 401, 'Revoked admin session is rejected');

  res = await get('/api/auth/consultant/me', consultant.cookie);
  assert(res.status === 200, 'Consultant session stays valid after admin logout');

  await db.execute(`UPDATE portal_users SET account_status = 'inactive' WHERE email = ?`, [ACCOUNTS.consultant.email]);
  res = await get('/api/auth/consultant/me', consultant.cookie);
  assert(res.status === 401, 'Deactivated consultant is signed out immediately');

  // --- returnTo sanitization (open redirect protection) ---
  const fallback = '/consultant/dashboard';
  assert(
    sanitizeReturnTo('//evil.com', fallback) === fallback &&
      sanitizeReturnTo('/\\evil.com', fallback) === fallback &&
      sanitizeReturnTo('https://malicious.org', fallback) === fallback &&
      sanitizeReturnTo('/consultant/dashboard?tab=overview', fallback) === '/consultant/dashboard?tab=overview',
    'returnTo sanitization blocks protocol-relative and external open redirects'
  );
}

try {
  await run();
} catch (err) {
  console.error('Test run crashed:', err);
  failed++;
} finally {
  const [result] = await db.execute(`DELETE FROM portal_users WHERE email LIKE '${TEST_EMAIL_PREFIX}%@example.com'`);
  await db.end();
  console.log(`\ncleanup: removed ${result.affectedRows} test accounts`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
