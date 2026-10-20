// Makes `npm start` work with no database setup.
// 1. MySQL from .env is reachable  -> use it (and create the database from db/*.sql if it is missing).
// 2. No MySQL / wrong login         -> start a temporary MySQL (mysql-memory-server) and load
//                                      db/schema.sql + db/seed.sql. Its data is gone when the server stops.
// Must run BEFORE anything requires src/config/db.js, because the pool reads process.env once.
const mysql = require('mysql2/promise');
const { createDB } = require('mysql-memory-server');
const { resetDatabase } = require('../../scripts/db-reset');

// Errors that mean "there is no usable MySQL here", as opposed to a bug in our SQL.
const NO_MYSQL_ERRORS = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR']);

const dbName = () => process.env.DB_NAME || 'aura_rental';

async function connectToConfiguredMysql() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    connectTimeout: 3000,
  });
}

async function databaseExists(connection) {
  const [rows] = await connection.query('SHOW DATABASES LIKE ?', [dbName()]);
  return rows.length > 0;
}

async function startTemporaryMysql() {
  console.log('No MySQL found, starting a temporary one (first run downloads MySQL, please wait)...');
  const db = await createDB({ version: '8.4.x' });
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = String(db.port);
  process.env.DB_USER = db.username;
  process.env.DB_PASSWORD = '';
  await resetDatabase();
  console.log('Temporary MySQL ready with sample data. Changes are lost when you stop the server.');
}

async function ensureDatabase() {
  let connection;
  try {
    connection = await connectToConfiguredMysql();
  } catch (err) {
    if (!NO_MYSQL_ERRORS.has(err.code)) throw err;
    await startTemporaryMysql();
    return;
  }
  try {
    if (!(await databaseExists(connection))) {
      await resetDatabase();
      console.log(`Database ${dbName()} was missing, created it with sample data.`);
    }
  } finally {
    await connection.end();
  }
}

module.exports = { ensureDatabase };
