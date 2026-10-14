import 'server-only';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'preconnect_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

let pool;

if (process.env.NODE_ENV === 'production') {
  pool = mysql.createPool(dbConfig);
} else {
  // Prevent duplicate pools during development Fast Refresh
  if (!global._mysqlPool) {
    global._mysqlPool = mysql.createPool(dbConfig);
  }
  pool = global._mysqlPool;
}

export default pool;

/**
 * Execute parameterized query with connection safety
 * @param {string} sql 
 * @param {Array<any>} params 
 * @returns {Promise<any>}
 */
export async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}
