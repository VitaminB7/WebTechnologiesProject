const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aura_rental',
  connectionLimit: 10,
  charset: 'utf8mb4',
  decimalNumbers: true,
  timezone: 'Z',
});

// Store and read DATETIME values as UTC so Log.DateTime serialises to a correct ISO string.
pool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

module.exports = pool;
