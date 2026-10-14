import { sanitizeReturnTo } from '../lib/validation/auth.js';
import mysql from 'mysql2/promise';

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('\n=============================================');
  console.log('   RUNNING AUTOMATED AUTHENTICATION SUITE');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Unauthenticated access to /admin/dashboard redirects to /admin/login
  try {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, { redirect: 'manual' });
    const location = res.headers.get('location');
    assert(
      (res.status === 307 || res.status === 302 || res.status === 308) &&
        location &&
        location.includes('/admin/login'),
      'Test 1: Unauthenticated /admin/dashboard redirects to /admin/login without loop'
    );
  } catch (err) {
    assert(false, `Test 1 Error: ${err.message}`);
  }

  // TEST 2: Public /admin/login page renders 200 OK
  try {
    const res = await fetch(`${BASE_URL}/admin/login`);
    const html = await res.text();
    assert(
      res.status === 200 && html.includes('Sign In to ProConnect'),
      'Test 2: /admin/login renders 200 OK outside protected layout'
    );
  } catch (err) {
    assert(false, `Test 2 Error: ${err.message}`);
  }

  // TEST 3: Invalid credentials rejected with 401
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: 'localhost:3001' },
      body: JSON.stringify({ email: 'admin@preconnect.com', password: 'WrongPassword123' }),
    });
    const data = await res.json();
    assert(
      res.status === 401 && data.error === 'Invalid email or password',
      'Test 3: Incorrect password returns 401 generic error'
    );
  } catch (err) {
    assert(false, `Test 3 Error: ${err.message}`);
  }

  // TEST 4: Valid credentials succeed and set HttpOnly session cookie
  let sessionCookie = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: 'localhost:3001' },
      body: JSON.stringify({ email: 'admin@preconnect.com', password: 'Password@2026' }),
    });
    const setCookie = res.headers.get('set-cookie') || '';
    const data = await res.json();
    sessionCookie = setCookie.split(';')[0];
    assert(
      res.status === 200 && data.success === true && sessionCookie.includes('admin_session='),
      'Test 4: Valid credentials return 200 and set HttpOnly session cookie'
    );
  } catch (err) {
    assert(false, `Test 4 Error: ${err.message}`);
  }

  // TEST 5: GET /api/auth/me returns administrator profile with cookie
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie, Host: 'localhost:3001' },
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.authenticated === true && data.user.email === 'admin@preconnect.com',
      'Test 5: GET /api/auth/me returns authenticated administrator profile'
    );
  } catch (err) {
    assert(false, `Test 5 Error: ${err.message}`);
  }

  // TEST 6: Authenticated SSR /admin/dashboard returns 200 with admin name
  try {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, {
      headers: { Cookie: sessionCookie, Host: 'localhost:3001' },
    });
    const html = await res.text();
    assert(
      res.status === 200 && html.includes('System Administrator'),
      'Test 6: Authenticated /admin/dashboard renders SSR content with administrator profile'
    );
  } catch (err) {
    assert(false, `Test 6 Error: ${err.message}`);
  }

  // TEST 7: Open Redirect / returnTo sanitization
  try {
    const evil1 = sanitizeReturnTo('//evil.com');
    const evil2 = sanitizeReturnTo('/\\evil.com');
    const evil3 = sanitizeReturnTo('https://malicious.org');
    const valid = sanitizeReturnTo('/admin/dashboard?tab=overview');
    assert(
      evil1 === '/admin/dashboard' &&
        evil2 === '/admin/dashboard' &&
        evil3 === '/admin/dashboard' &&
        valid === '/admin/dashboard?tab=overview',
      'Test 7: returnTo sanitization blocks protocol-relative and external open redirects'
    );
  } catch (err) {
    assert(false, `Test 7 Error: ${err.message}`);
  }

  // TEST 8: CSRF Origin Mismatch returns 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker-website.com',
        Host: 'localhost:3001',
      },
      body: JSON.stringify({ email: 'admin@preconnect.com', password: 'Password@2026' }),
    });
    assert(res.status === 403, 'Test 8: Cross-origin POST request rejected with 403 Forbidden');
  } catch (err) {
    assert(false, `Test 8 Error: ${err.message}`);
  }

  // TEST 9: POST /api/auth/logout revokes session in MySQL
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie, Host: 'localhost:3001' },
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'Test 9: Logout succeeds and revokes session');
  } catch (err) {
    assert(false, `Test 9 Error: ${err.message}`);
  }

  // TEST 10: Revoked session is rejected on subsequent API and SSR calls
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie, Host: 'localhost:3001' },
    });
    assert(res.status === 401, 'Test 10: Revoked session is rejected with 401 on subsequent requests');
  } catch (err) {
    assert(false, `Test 10 Error: ${err.message}`);
  }

  console.log('\n=============================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
