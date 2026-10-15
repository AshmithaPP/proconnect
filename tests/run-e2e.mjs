/**
 * Runs every test suite against a SEPARATE test database and its own dev server, so tests
 * can never change — or even show up in — the real site/database.
 *
 *   npm run test:e2e
 *
 * - Test database: TEST_DB_NAME, default "<DB_NAME>_test" (e.g. preconnect_db_test). Created
 *   and migrated automatically. Refuses to run if it equals the real DB_NAME.
 * - Test server: http://localhost:3005 with its own build folder (.next-test).
 */
import { spawn, spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const REAL_DB = process.env.DB_NAME || 'preconnect_db';
const TEST_DB = process.env.TEST_DB_NAME || `${REAL_DB}_test`;
const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;
const SUITES = [
  'tests/unit/slot-engine.test.js',
  'tests/e2e/auth.test.js',
  'tests/e2e/admin-portal.test.js',
  'tests/e2e/schedule.test.js',
  'tests/e2e/reschedule.test.js',
  'tests/e2e/bookings.test.js',
  'tests/e2e/payment-flow.test.js',
];

if (TEST_DB === REAL_DB) {
  console.error(`Refusing to run: the test database (${TEST_DB}) is the real database.`);
  process.exit(1);
}

const testEnv = { ...process.env, DB_NAME: TEST_DB, BASE_URL };

async function isUp() {
  try {
    const res = await fetch(`${BASE_URL}/api/bookings/availability`, { signal: AbortSignal.timeout(10000) });
    return res.ok;
  } catch {
    return false;
  }
}

function stopServer(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    // already stopped
  }
}

console.log(`\nTest database: ${TEST_DB}  (real database ${REAL_DB} is never used)\n`);

if (await isUp()) {
  console.error(`Port ${PORT} is already in use — stop that server first (it may point at the real database).`);
  process.exit(1);
}

const migrate = spawnSync(process.execPath, ['db/migrate.js'], { cwd: root, env: testEnv, encoding: 'utf8' });
if (migrate.status !== 0) {
  console.error(migrate.error || '', migrate.stdout || '', migrate.stderr || '');
  process.exit(1);
}
console.log('✓ Test database migrated');

const logPath = path.join(root, '.next-test-server.log');
const log = fs.openSync(logPath, 'w');
const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  cwd: root,
  env: { ...testEnv, NEXT_DIST_DIR: '.next-test' },
  stdio: ['ignore', log, log],
  shell: process.platform === 'win32',
  detached: process.platform !== 'win32',
});

let failed = 0;
try {
  const started = Date.now();
  while (!(await isUp())) {
    if (Date.now() - started > 240000) throw new Error(`Test server did not start — see ${logPath}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log(`✓ Test server up on ${BASE_URL}\n`);

  for (const suite of SUITES) {
    console.log(`=== ${suite}`);
    const result = spawnSync(process.execPath, [suite, BASE_URL], { cwd: root, env: testEnv, stdio: 'inherit' });
    if (result.status !== 0) failed++;
  }
} catch (err) {
  console.error(err.message);
  failed++;
} finally {
  stopServer(server);
}

console.log(failed ? `\n✗ ${failed} suite(s) failed` : '\n✓ All suites passed');
process.exit(failed ? 1 : 0);
