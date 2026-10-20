// Recreate the database from db/schema.sql + db/seed.sql without needing the mysql CLI.
// Usage: npm run db:reset            (uses DB_NAME from .env, default aura_rental)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_DIR = path.join(__dirname, '..', '..', 'db');
// schema.sql / seed.sql are written for the database "aura_rental"; tests swap in another name.
const SCRIPT_DB_NAME = /\baura_rental\b/g;

function readSql(fileName, dbName) {
  return fs.readFileSync(path.join(DB_DIR, fileName), 'utf8').replace(SCRIPT_DB_NAME, dbName);
}

async function resetDatabase({ dbName = process.env.DB_NAME || 'aura_rental', seed = true } = {}) {
  if (!/^\w+$/.test(dbName)) throw new Error(`Unsafe database name: ${dbName}`);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    // Same UTC session time zone as the app pool, so seeded timestamps read back correctly.
    await connection.query("SET time_zone = '+00:00'");
    await connection.query(readSql('schema.sql', dbName));
    if (seed) await connection.query(readSql('seed.sql', dbName));
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  resetDatabase()
    .then(() => console.log(`Database ${process.env.DB_NAME || 'aura_rental'} reset with schema + seed data.`))
    .catch((err) => {
      console.error('Database reset failed:', err.message);
      process.exitCode = 1;
    });
}

module.exports = { resetDatabase };
