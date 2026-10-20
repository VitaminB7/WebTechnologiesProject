const MAX_LENGTH = 500;

// LogID is text ("L-12"), so ids are compared by their number: L-10 must come after L-9.
const LOG_NUMBER_SQL = 'CAST(SUBSTRING(LogID, 3) AS UNSIGNED)';

/**
 * Next free LogID. FOR UPDATE locks the Log rows until the caller's transaction ends,
 * so two writers at the same time cannot both pick the same number.
 */
async function nextLogId(db) {
  const [[{ maxNumber }]] = await db.execute(
    `SELECT COALESCE(MAX(${LOG_NUMBER_SQL}), 0) AS maxNumber FROM Log FOR UPDATE`,
  );
  return `L-${Number(maxNumber) + 1}`;
}

/**
 * Write one audit row to Log. `db` must be the connection of an open transaction,
 * so the log commits or rolls back together with the change (and the id lock holds).
 */
async function logAction(db, username, message) {
  const text = message.length > MAX_LENGTH ? `${message.slice(0, MAX_LENGTH - 3)}...` : message;
  const logId = await nextLogId(db);
  await db.execute(
    'INSERT INTO Log (LogID, Username, Changed, DateTime) VALUES (?, ?, ?, UTC_TIMESTAMP())',
    [logId, username, text],
  );
}

/** Describe what changed between two flat objects: "price 15000 -> 16000, size 30 -> 32". */
function describeChanges(before, after) {
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => `${key} ${formatValue(before[key])} -> ${formatValue(after[key])}`)
    .join(', ');
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value === null || value === undefined || value === '') return '(empty)';
  return String(value);
}

module.exports = { logAction, describeChanges, LOG_NUMBER_SQL };
