/**
 * Phase 2 — admin portal: settings, SMTP + email, templates, consultant accounts, own password,
 * and admin access to the shared (consultant) features.
 * Usage: npm run test:admin   (BASE_URL defaults to http://localhost:3000)
 *
 * Uses temporary accounts and a local SMTP server (smtp-server). Settings and templates are
 * snapshotted first and restored at the end, so the real configuration is left untouched.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { SMTPServer } from 'smtp-server';
import { SETTING_DEFAULTS } from '../../src/features/settings/settings.definitions.js';

dotenv.config({ path: '.env.local', quiet: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ORIGIN = new URL(BASE_URL).origin;
const TEST_PREFIX = 'portal.test.';
const stamp = Date.now();
const PASSWORD = `Test-${crypto.randomBytes(6).toString('hex')}`;
const ADMIN_EMAIL = `${TEST_PREFIX}admin.${stamp}@example.com`;
const CONSULTANT_EMAIL = `${TEST_PREFIX}consultant.${stamp}@example.com`;
const SINK_RECIPIENT = `${TEST_PREFIX}inbox.${stamp}@example.com`;
const SMTP_PORT = 2600 + Math.floor(Math.random() * 300);

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

// --- local SMTP sink ---
const receivedMail = [];
const smtpServer = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  onAuth(auth, session, callback) {
    callback(null, { user: auth.username });
  },
  onData(stream, session, callback) {
    let raw = '';
    stream.on('data', (chunk) => (raw += chunk));
    stream.on('end', () => {
      receivedMail.push({ to: session.envelope.rcptTo.map((r) => r.address), raw, user: session.user });
      callback();
    });
  },
});
await new Promise((resolve) => smtpServer.listen(SMTP_PORT, '127.0.0.1', resolve));

// --- helpers ---
async function api(path, { method = 'GET', cookie, body, origin = ORIGIN } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { _html: text };
  }
  return { status: res.status, data, text, location: res.headers.get('location') };
}

async function login(portalKey, email, password = PASSWORD) {
  const res = await fetch(`${BASE_URL}/api/auth/${portalKey}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

const isRedirectTo = (r, path) => [302, 307, 308].includes(r.status) && r.location?.includes(path);

// --- snapshot of real configuration ---
const [settingsSnapshot] = await db.query('SELECT setting_key, setting_value, updated_by_user_id FROM site_settings');
const [templatesSnapshot] = await db.query('SELECT * FROM email_templates');
let adminCookie = '';

async function run() {
  console.log(`\nAdmin portal tests against ${BASE_URL} (local SMTP on ${SMTP_PORT})\n`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const [email, role] of [[ADMIN_EMAIL, 'platform_admin'], [CONSULTANT_EMAIL, 'consultant']]) {
    await db.execute(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [crypto.randomUUID(), role === 'consultant' ? 'Test Consultant' : 'Test Admin', email, passwordHash, role]
    );
  }
  const admin = (await login('admin', ADMIN_EMAIL)).cookie;
  adminCookie = admin;
  const consultant = (await login('consultant', CONSULTANT_EMAIL)).cookie;
  assert(admin.startsWith('admin_session=') && consultant.startsWith('consultant_session='), 'Test accounts signed in');

  // --- Access control ---
  let r = await api('/api/admin/settings/general', { cookie: consultant });
  assert(r.status === 401, 'Consultant cannot read admin settings API');
  r = await api('/api/admin/settings/general', { method: 'PUT', cookie: consultant, body: { siteName: 'x' } });
  assert(r.status === 401, 'Consultant cannot change admin settings');
  r = await api('/api/admin/consultants', { cookie: consultant });
  assert(r.status === 401, 'Consultant cannot list consultant accounts');
  r = await api('/admin/dashboard/settings/general', { cookie: consultant });
  assert(isRedirectTo(r, '/admin/login'), 'Consultant is sent to admin login from settings page');
  r = await api('/api/admin/settings/general', { method: 'PUT', cookie: admin, body: { siteName: 'x' }, origin: 'https://evil.example' });
  assert(r.status === 403, 'Cross-origin settings change rejected (CSRF)');
  r = await api('/api/admin/settings/unknown', { cookie: admin });
  assert(r.status === 404, 'Unknown setting key returns 404');

  // --- Admin has the consultant's features ---
  r = await api('/api/consultant/bookings', { cookie: admin });
  assert(r.status === 200 && Array.isArray(r.data.bookings), 'Admin can read the shared bookings API');
  r = await api('/admin/dashboard/bookings', { cookie: admin });
  assert(r.status === 200 && r.text.includes('Needs reschedule'), 'Admin Bookings page shows the consultant bookings view');

  // --- Admin pages render ---
  for (const [path, marker] of [
    ['/admin/dashboard/settings/general', 'Business timezone'],
    ['/admin/dashboard/settings/seo', 'Meta description'],
    ['/admin/dashboard/settings/smtp', 'Send test email'],
    ['/admin/dashboard/email-templates', 'Booking confirmed'],
    ['/admin/dashboard/consultants', 'Add a consultant'],
    ['/admin/dashboard/account', 'Change password'],
    ['/consultant/dashboard/account', 'Change password'],
  ]) {
    r = await api(path, { cookie: path.startsWith('/admin') ? admin : consultant });
    assert(r.status === 200 && r.text.includes(marker), `${path} renders`);
  }
  r = await api('/admin/dashboard/settings', { cookie: admin });
  assert(isRedirectTo(r, '/admin/dashboard/settings/general'), '/admin/dashboard/settings opens the General tab');

  // --- General settings ---
  r = await api('/api/admin/settings/general', { method: 'PUT', cookie: admin, body: { siteName: '', contactEmail: 'nope', timezone: 'Mars/Base' } });
  assert(r.status === 400 && r.data.fieldErrors?.siteName && r.data.fieldErrors?.contactEmail && r.data.fieldErrors?.timezone,
    'Invalid general settings rejected with field errors', r.data);
  r = await api('/api/admin/settings/general', {
    method: 'PUT', cookie: admin,
    body: { siteName: 'ProConnect E2E', contactEmail: 'Hello@Example.com', contactPhone: '+91 90000 00000', timezone: 'Asia/Kolkata' },
  });
  assert(r.status === 200 && r.data.value.siteName === 'ProConnect E2E' && r.data.value.contactEmail === 'hello@example.com',
    'General settings saved and normalised', r.data);

  // --- SEO applied to the live site ---
  const seoTitle = `E2E SEO Title ${stamp}`;
  r = await api('/api/admin/settings/seo', {
    method: 'PUT', cookie: admin,
    body: { metaTitle: seoTitle, metaDescription: 'E2E description', allowIndexing: false, googleAnalyticsId: 'G-TEST1234', canonicalUrl: 'https://www.example.com' },
  });
  assert(r.status === 200, 'SEO settings saved', r.data);
  let home = await api('/');
  assert(home.text.includes(`<title>${seoTitle}</title>`), 'Homepage <title> uses the saved SEO title');
  assert(/<meta name="robots" content="noindex, nofollow"/.test(home.text), 'Indexing off → homepage has noindex');
  assert(home.text.includes('G-TEST1234'), 'Google Analytics ID is injected');
  r = await api('/robots.txt');
  assert(/Disallow: \/\s*$/m.test(r.text), 'Indexing off → robots.txt disallows everything', r.text);
  r = await api('/api/admin/settings/seo', { method: 'PUT', cookie: admin, body: { metaTitle: seoTitle, metaDescription: 'E2E description', allowIndexing: true, canonicalUrl: 'https://www.example.com' } });
  r = await api('/robots.txt');
  assert(r.text.includes('Disallow: /admin') && r.text.includes('Sitemap: https://www.example.com/sitemap.xml'),
    'Indexing on → robots.txt blocks portals and lists the sitemap', r.text);
  r = await api('/sitemap.xml');
  assert(r.text.includes('<loc>https://www.example.com/</loc>'), 'sitemap.xml uses the canonical URL');
  r = await api('/api/admin/settings/seo', { method: 'PUT', cookie: admin, body: { metaTitle: 'x', metaDescription: 'y', googleAnalyticsId: '<script>' } });
  assert(r.status === 400 && r.data.fieldErrors?.googleAnalyticsId, 'Malformed Google Analytics ID rejected');

  // --- SMTP: password encrypted, never returned ---
  const smtpPassword = `SmtpSecret-${stamp}`;
  const smtpSettings = {
    isEnabled: true, host: '127.0.0.1', port: SMTP_PORT, security: 'none',
    username: 'mailer', fromName: 'ProConnect E2E', fromEmail: 'bookings@example.com', replyToEmail: '',
  };
  r = await api('/api/admin/settings/smtp', { method: 'PUT', cookie: admin, body: { ...smtpSettings, password: smtpPassword } });
  assert(r.status === 200 && r.data.value.hasPassword === true && !r.text.includes(smtpPassword),
    'SMTP saved; response has hasPassword but never the password', r.data);
  const [[smtpRow]] = await db.query(`SELECT CAST(setting_value AS CHAR) AS v FROM site_settings WHERE setting_key = 'smtp'`);
  assert(!smtpRow.v.includes(smtpPassword) && JSON.parse(smtpRow.v).password?.startsWith('v1:'),
    'SMTP password is stored encrypted in MySQL');
  r = await api('/api/admin/settings/smtp', { cookie: admin });
  assert(r.data.value.hasPassword === true && !r.text.includes(smtpPassword) && !('password' in r.data.value),
    'GET SMTP settings never includes the password');
  r = await api('/api/admin/settings/smtp', { method: 'PUT', cookie: admin, body: { ...smtpSettings, password: '' } });
  assert(r.status === 200 && r.data.value.hasPassword === true, 'Saving with an empty password keeps the saved one');
  r = await api('/api/admin/settings/smtp', { method: 'PUT', cookie: admin, body: { ...smtpSettings, host: 'not a host!', port: 70000 } });
  assert(r.status === 400 && r.data.fieldErrors?.host && r.data.fieldErrors?.port, 'Invalid SMTP host/port rejected');

  // --- SMTP test email really delivered ---
  receivedMail.length = 0;
  r = await api('/api/admin/smtp-test', { method: 'POST', cookie: admin, body: { settings: smtpSettings, to: SINK_RECIPIENT } });
  assert(r.status === 200, 'SMTP test endpoint succeeds', r.data);
  const testMail = receivedMail.find((m) => m.to.includes(SINK_RECIPIENT));
  assert(testMail && /SMTP[ _]test[ _]email/.test(testMail.raw) && testMail.user === 'mailer',
    'Test email arrived at the SMTP server, authenticated with the saved (decrypted) password', testMail?.raw?.slice(0, 300));
  r = await api('/api/admin/smtp-test', { method: 'POST', cookie: admin, body: { settings: { ...smtpSettings, port: 1 }, to: SINK_RECIPIENT } });
  assert(r.status === 502 && r.data.error.startsWith('SMTP error'), 'Unreachable SMTP server → clear SMTP error', r.data);
  const [deliveries] = await db.query(`SELECT delivery_status, error_message FROM email_deliveries WHERE recipient_email = ? AND template_key = 'smtp_test'`, [SINK_RECIPIENT]);
  assert(deliveries.some((x) => x.delivery_status === 'sent') && deliveries.some((x) => x.delivery_status === 'failed' && x.error_message),
    'Sent and failed sends are both logged in email_deliveries', deliveries);
  r = await api('/admin/dashboard/settings/smtp', { cookie: admin });
  assert(r.text.includes(SINK_RECIPIENT), 'SMTP page lists recent emails');

  // --- Email templates ---
  r = await api('/api/admin/email-templates', { cookie: admin });
  assert(r.status === 200 && r.data.templates.some((t) => t.templateKey === 'booking_confirmed_customer'), 'Templates listed');
  r = await api('/api/admin/email-templates/booking_confirmed_customer', { method: 'PUT', cookie: admin, body: { emailSubject: '', bodyHtml: '' } });
  assert(r.status === 400 && r.data.fieldErrors?.emailSubject && r.data.fieldErrors?.bodyHtml, 'Empty template rejected');
  r = await api('/api/admin/email-templates/smtp_test', {
    method: 'PUT', cookie: admin, body: { emailSubject: 'Custom test for {{site_name}}', bodyHtml: '<p>Custom body {{sent_at}}</p>', isEnabled: true },
  });
  assert(r.status === 200 && r.data.template.isCustomized, 'Template saved as customised');
  receivedMail.length = 0;
  await api('/api/admin/smtp-test', { method: 'POST', cookie: admin, body: { settings: smtpSettings, to: SINK_RECIPIENT } });
  assert(receivedMail.some((m) => m.raw.includes('Custom test for ProConnect E2E') && m.raw.includes('Custom body')),
    'Sent email uses the customised template with placeholders filled');
  r = await api('/api/admin/email-templates/smtp_test', { method: 'DELETE', cookie: admin });
  assert(r.status === 200 && !r.data.template.isCustomized && r.data.template.emailSubject.includes('SMTP test email'), 'Reset to default');
  r = await api('/api/admin/email-templates/nope', { method: 'PUT', cookie: admin, body: { emailSubject: 'a', bodyHtml: 'b' } });
  assert(r.status === 404, 'Unknown template returns 404');

  // --- Consultant accounts ---
  const newEmail = `${TEST_PREFIX}managed.${stamp}@example.com`;
  r = await api('/api/admin/consultants', { method: 'POST', cookie: admin, body: { fullName: 'Managed One', email: newEmail, password: 'short' } });
  assert(r.status === 400 && r.data.fieldErrors?.password, 'Weak initial password rejected');
  r = await api('/api/admin/consultants', { method: 'POST', cookie: admin, body: { fullName: 'Managed One', email: newEmail, password: PASSWORD } });
  assert(r.status === 201 && r.data.portalUserId, 'Admin creates a consultant account', r.data);
  const managedId = r.data.portalUserId;
  r = await api('/api/admin/consultants', { method: 'POST', cookie: admin, body: { fullName: 'Dup', email: ADMIN_EMAIL, password: PASSWORD } });
  assert(r.status === 409, 'Email already used (even by an admin) is rejected');

  let managed = await login('consultant', newEmail);
  assert(managed.status === 200, 'New consultant can sign in');
  r = await api(`/api/admin/consultants/${managedId}`, { method: 'PATCH', cookie: consultant, body: { accountStatus: 'inactive' } });
  assert(r.status === 401, 'Consultant cannot manage consultant accounts');
  r = await api(`/api/admin/consultants/${managedId}`, { method: 'PATCH', cookie: admin, body: { accountStatus: 'inactive' } });
  assert(r.status === 200, 'Admin deactivates the consultant');
  r = await api('/api/auth/consultant/me', { cookie: managed.cookie });
  assert(r.status === 401 && (await login('consultant', newEmail)).status === 401, 'Deactivated consultant is signed out and cannot sign in');
  await api(`/api/admin/consultants/${managedId}`, { method: 'PATCH', cookie: admin, body: { accountStatus: 'active', fullName: 'Managed Renamed', email: newEmail } });
  managed = await login('consultant', newEmail);
  assert(managed.status === 200, 'Re-activated consultant can sign in again');

  const resetPassword = `Reset-${crypto.randomBytes(6).toString('hex')}`;
  r = await api(`/api/admin/consultants/${managedId}/password`, { method: 'PUT', cookie: admin, body: { password: resetPassword } });
  assert(r.status === 200, 'Admin resets the consultant password');
  r = await api('/api/auth/consultant/me', { cookie: managed.cookie });
  assert(r.status === 401, 'Password reset signs the consultant out everywhere');
  assert((await login('consultant', newEmail)).status === 401 && (await login('consultant', newEmail, resetPassword)).status === 200,
    'Old password stops working, new one works');
  r = await api(`/api/admin/consultants/${crypto.randomUUID()}`, { method: 'PATCH', cookie: admin, body: { accountStatus: 'inactive' } });
  assert(r.status === 404, 'Unknown consultant returns 404');
  const [[adminRow]] = await db.query(`SELECT portal_user_id FROM portal_users WHERE email = ?`, [ADMIN_EMAIL]);
  r = await api(`/api/admin/consultants/${adminRow.portal_user_id}`, { method: 'PATCH', cookie: admin, body: { accountStatus: 'inactive' } });
  assert(r.status === 404, 'Admin accounts cannot be changed through the consultants API');

  // --- Change own password ---
  const secondSession = (await login('consultant', CONSULTANT_EMAIL)).cookie;
  r = await api('/api/auth/consultant/password', { method: 'PUT', cookie: consultant, body: { currentPassword: 'wrong-password', newPassword: 'Another-Pass-123' } });
  assert(r.status === 400 && r.data.fieldErrors?.currentPassword, 'Wrong current password rejected');
  const ownNewPassword = `Own-${crypto.randomBytes(6).toString('hex')}`;
  r = await api('/api/auth/consultant/password', { method: 'PUT', cookie: consultant, body: { currentPassword: PASSWORD, newPassword: ownNewPassword } });
  assert(r.status === 200, 'Consultant changes own password');
  assert((await api('/api/auth/consultant/me', { cookie: consultant })).status === 200, 'Current session stays signed in');
  assert((await api('/api/auth/consultant/me', { cookie: secondSession })).status === 401, 'Other sessions are signed out');
  assert((await login('consultant', CONSULTANT_EMAIL, ownNewPassword)).status === 200, 'New own password works');
  r = await api('/api/auth/admin/password', { method: 'PUT', cookie: consultant, body: { currentPassword: ownNewPassword, newPassword: 'x'.repeat(12) } });
  assert(r.status === 401, 'Consultant session cannot use the admin password endpoint');
}

try {
  await run();
} catch (err) {
  console.error('Test run crashed:', err);
  failed++;
} finally {
  // Restore the public settings through the API first, so the website's settings cache is
  // refreshed (a direct DB write would leave test values cached), then restore the DB exactly.
  for (const settingKey of ['general', 'seo']) {
    const saved = settingsSnapshot.find((row) => row.setting_key === settingKey)?.setting_value;
    const value = { ...SETTING_DEFAULTS[settingKey], ...(typeof saved === 'string' ? JSON.parse(saved) : saved || {}) };
    if (adminCookie) await api(`/api/admin/settings/${settingKey}`, { method: 'PUT', cookie: adminCookie, body: value });
  }
  // Restore real configuration exactly as it was
  await db.query('DELETE FROM site_settings');
  for (const row of settingsSnapshot) {
    await db.execute('INSERT INTO site_settings (setting_key, setting_value, updated_by_user_id) VALUES (?, CAST(? AS JSON), ?)', [
      row.setting_key, typeof row.setting_value === 'string' ? row.setting_value : JSON.stringify(row.setting_value), row.updated_by_user_id,
    ]);
  }
  await db.query('DELETE FROM email_templates');
  for (const row of templatesSnapshot) {
    await db.execute('INSERT INTO email_templates (template_key, email_subject, body_html, is_enabled, updated_by_user_id) VALUES (?, ?, ?, ?, ?)', [
      row.template_key, row.email_subject, row.body_html, row.is_enabled, row.updated_by_user_id,
    ]);
  }
  await db.execute(`DELETE FROM email_deliveries WHERE recipient_email LIKE '${TEST_PREFIX}%@example.com'`);
  const [result] = await db.execute(`DELETE FROM portal_users WHERE email LIKE '${TEST_PREFIX}%@example.com'`);
  await db.end();
  await new Promise((resolve) => smtpServer.close(resolve));
  console.log(`\ncleanup: restored settings/templates, removed ${result.affectedRows} test accounts`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
