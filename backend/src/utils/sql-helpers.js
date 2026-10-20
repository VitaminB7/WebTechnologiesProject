function isDuplicateKey(err) {
  return Boolean(err) && err.code === 'ER_DUP_ENTRY';
}

/** "?, ?, ?" for an IN (...) list. Only the count comes from the caller, never the values. */
function placeholders(count) {
  return new Array(count).fill('?').join(', ');
}

/** Escape LIKE wildcards so user text is matched literally. */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

module.exports = { isDuplicateKey, placeholders, escapeLike };
