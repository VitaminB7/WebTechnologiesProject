const pool = require('../config/db');
const { toLog } = require('../utils/mappers');
const { LOG_NUMBER_SQL } = require('../utils/log-action');

async function listLatestLogs() {
  const [rows] = await pool.execute(
    `SELECT LogID, Username, Changed, DateTime FROM Log
     ORDER BY DateTime DESC, ${LOG_NUMBER_SQL} DESC LIMIT 100`,
  );
  return rows.map(toLog);
}

module.exports = { listLatestLogs };
