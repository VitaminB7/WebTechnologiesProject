const APP_TIME_ZONE = 'Asia/Bangkok';

/** Today's date in Bangkok as 'YYYY-MM-DD', independent of the server's own timezone. */
function todayInBangkok(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
}

module.exports = { todayInBangkok };
