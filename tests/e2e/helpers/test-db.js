/**
 * E2E suites create, edit and delete data (bookings, the consultant account, settings), so they
 * must never run against the real database. Run them with `npm run test:e2e`, which points
 * them (and its own dev server) at a separate test database.
 */
import fs from 'fs';
import dotenv from 'dotenv';

export function assertTestDatabase() {
  let realDb = 'preconnect_db';
  try {
    realDb = dotenv.parse(fs.readFileSync('.env.local')).DB_NAME || realDb;
  } catch {
    // no .env.local — fall back to the default name
  }
  const current = process.env.DB_NAME || realDb;
  if (current === realDb) {
    console.error(`\n✗ Refusing to run against the real database (${realDb}).\n  Use: npm run test:e2e   (runs every suite on a separate test database)\n`);
    process.exit(1);
  }
}
