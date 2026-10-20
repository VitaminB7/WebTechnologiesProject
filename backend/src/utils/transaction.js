const pool = require('../config/db');

// MySQL may pick one of two concurrent transactions as a deadlock victim (e.g. two first
// Log writes on an empty Log table). The victim is fully rolled back, so running it again is safe.
const MAX_ATTEMPTS = 3;

/** Run `work(connection)` once inside a transaction; commit on success, roll back on any error. */
async function runOnce(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/** Run `work(connection)` inside a transaction, retrying when MySQL reports a deadlock. */
async function withTransaction(work) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await runOnce(work);
    } catch (err) {
      if (err.code !== 'ER_LOCK_DEADLOCK' || attempt === MAX_ATTEMPTS) throw err;
    }
  }
}

module.exports = withTransaction;
