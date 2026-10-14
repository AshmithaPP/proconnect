import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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

async function createAdmin() {
  console.log('\n=============================================');
  console.log('   PROCONNECT ADMIN PROVISIONING UTILITY');
  console.log('=============================================\n');

  const fullName = await askQuestion('Enter Administrator Full Name: ');
  if (!fullName) {
    console.error('Error: Full Name is required.');
    process.exit(1);
  }

  const email = (await askQuestion('Enter Administrator Email: ')).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    console.error('Error: A valid email address is required.');
    process.exit(1);
  }

  const password = await askHiddenPassword('Enter Secure Password (hidden, min 10 chars, max 72 chars): ');
  const confirmPassword = await askHiddenPassword('Confirm Password (hidden): ');

  if (password !== confirmPassword) {
    console.error('\nError: Passwords do not match.');
    process.exit(1);
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

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = Number(process.env.DB_PORT) || 3306;
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'preconnect_db';

  console.log('\nConnecting to database...');
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    // Check if email already exists
    const [existing] = await conn.execute(
      'SELECT admin_user_id FROM admin_users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.error(`\nError: An administrator account with email "${email}" already exists.`);
      process.exit(1);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const adminUserId = crypto.randomUUID();

    await conn.execute(
      `INSERT INTO admin_users (admin_user_id, full_name, email, password_hash, account_status)
       VALUES (?, ?, ?, ?, 'active')`,
      [adminUserId, fullName, email, passwordHash]
    );

    console.log('\n✓ Administrator account successfully created!');
    console.log(`  Admin ID  : ${adminUserId}`);
    console.log(`  Name      : ${fullName}`);
    console.log(`  Email     : ${email}`);
    console.log(`  Status    : active`);
    console.log('\nYou can now log in at /admin/login using these credentials.\n');
  } catch (err) {
    console.error('\nFailed to create administrator:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

createAdmin();
