const { isPlainObject, checkString, collect } = require('./common');

function checkPresent(raw) {
  return typeof raw === 'string' && raw !== '' ? { value: raw } : { error: 'is required' };
}

function validateLogin(body) {
  const b = isPlainObject(body) ? body : {};
  return collect({
    username: checkString(b.username, 100),
    password: checkPresent(b.password),
  });
}

module.exports = { validateLogin };
