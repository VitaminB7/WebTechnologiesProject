const MAX_LENGTH = 500;

/**
 * Write one audit row to Log. `db` is the pool or the connection of an open
 * transaction, so the log commits or rolls back together with the change.
 */
async function logAction(db, username, message) {
  const text = message.length > MAX_LENGTH ? `${message.slice(0, MAX_LENGTH - 3)}...` : message;
  await db.execute('INSERT INTO Log (Username, Changed) VALUES (?, ?)', [username || null, text]);
}

/** Describe what changed between two flat objects: "price 15000 -> 16000, floor 3 -> 4". */
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

module.exports = { logAction, describeChanges };
