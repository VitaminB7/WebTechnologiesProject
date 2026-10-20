const pool = require('../config/db');
const { toLog } = require('../utils/mappers');

async function listLatestLogs() {
  const [rows] = await pool.execute('SELECT * FROM Log ORDER BY LogID DESC LIMIT 100');
  return rows.map(toLog);
}

module.exports = { listLatestLogs };
