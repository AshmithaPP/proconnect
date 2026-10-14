import mysql from 'mysql2/promise';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local and .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'preconnect_db';

async function runMigrations() {
  console.log(`Connecting to MySQL at ${dbHost}:${dbPort} as user "${dbUser}"...`);

  // 1. Connect without database to ensure database exists
  let serverConn;
  try {
    serverConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
    });
    await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✓ Database "${dbName}" verified.`);
  } catch (err) {
    console.error('Failed to verify/create database:', err.message);
    process.exit(1);
  } finally {
    if (serverConn) await serverConn.end();
  }

  // 2. Connect to the target database
  const dbConn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    multipleStatements: true,
  });

  try {
    // 3. Ensure schema_migrations table exists
    await dbConn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Fetch applied migrations
    const [appliedRows] = await dbConn.query('SELECT migration_name FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    // 5. Read migration directory
    const migrationsDir = path.resolve(process.cwd(), 'scripts', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`- Migration "${file}" already applied. Skipping.`);
        continue;
      }

      console.log(`Applying migration: "${file}"...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await dbConn.beginTransaction();
      try {
        await dbConn.query(sql);
        await dbConn.execute('INSERT INTO schema_migrations (migration_id, migration_name) VALUES (?, ?)', [crypto.randomUUID(), file]);
        await dbConn.commit();
        console.log(`✓ Successfully applied "${file}".`);
      } catch (migrationErr) {
        await dbConn.rollback();
        throw migrationErr;
      }
    }

    console.log('\n✓ All migrations are up to date.');
  } catch (err) {
    console.error('\n✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await dbConn.end();
  }
}

runMigrations();
