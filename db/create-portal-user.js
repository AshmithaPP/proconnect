import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Create a portal account.
 *
 *   npm run seed:admin        → platform_admin  (signs in at /admin/login)
 *   npm run seed:consultant   → consultant      (signs in at /consultant/login)
 *
 * Interactive by default. For scripts: --name "…" --email … and the password in the
 * PORTAL_USER_PASSWORD environment variable (never as an argument, so it stays out of
 * shell history and process lists).
 */

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

// Secure masked password prompt without echoing characters
function askHiddenPassword(query) {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      // Enter / Carriage Return
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(oldRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
        }
      } else {
        password += char;
      }
    };

    stdin.on('data', onData);
  });
}

const ROLES = {
  admin: { userRole: 'platform_admin', title: 'Platform Administrator', loginPath: '/admin/login' },
  consultant: { userRole: 'consultant', title: 'Consultant', loginPath: '/consultant/login' },
};

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function createPortalUser() {
  const roleKey = readArg('role') || 'admin';
  const role = ROLES[roleKey];
  if (!role) {
    console.error(`Error: --role must be "admin" or "consultant" (got "${roleKey}").`);
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log(`   PROCONNECT ${role.title.toUpperCase()} ACCOUNT`);
  console.log('=============================================\n');

  const fullName = readArg('name') || (await askQuestion(`Enter ${role.title} Full Name: `));
  if (!fullName) {
    console.error('Error: Full Name is required.');
    process.exit(1);
  }

  const email = (readArg('email') || (await askQuestion(`Enter ${role.title} Email: `))).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    console.error('Error: A valid email address is required.');
    process.exit(1);
  }

  let password = process.env.PORTAL_USER_PASSWORD;
  if (!password) {
    password = await askHiddenPassword('Enter Secure Password (hidden, min 10 chars, max 72 chars): ');
    const confirmPassword = await askHiddenPassword('Confirm Password (hidden): ');
    if (password !== confirmPassword) {
      console.error('\nError: Passwords do not match.');
      process.exit(1);
    }
  }

  if (password.length < 10) {
    console.error('\nError: Password must be at least 10 characters long.');
    process.exit(1);
  }

  // Bcrypt 72-byte safe limit
  if (Buffer.byteLength(password, 'utf8') > 72) {
    console.error('\nError: Password must not exceed 72 bytes.');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'preconnect_db',
  });

  try {
    // Emails are unique across both portals
    const [existing] = await conn.execute('SELECT portal_user_id FROM portal_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.error(`\nError: An account with email "${email}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const portalUserId = crypto.randomUUID();

    await conn.execute(
      `INSERT INTO portal_users (portal_user_id, full_name, email, password_hash, user_role, account_status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [portalUserId, fullName, email, passwordHash, role.userRole]
    );

    console.log(`\n✓ ${role.title} account created`);
    console.log(`  Account ID : ${portalUserId}`);
    console.log(`  Name       : ${fullName}`);
    console.log(`  Email      : ${email}`);
    console.log(`  Role       : ${role.userRole}`);
    console.log(`\nSign in at ${role.loginPath}\n`);
  } catch (err) {
    console.error('\nFailed to create account:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

createPortalUser();
