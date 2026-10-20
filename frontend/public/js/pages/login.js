import { getMe, login } from '../api.js';
import { clearFieldErrors, setBusy, showApiError } from '../ui.js';

const ADMIN_HOME = '/admin/rooms.html';
const form = document.getElementById('login-form');
const submit = document.getElementById('login-submit');

function validate(values) {
  const fields = {};
  if (!values.username) fields.username = 'Please enter your username or email';
  if (!values.password) fields.password = 'Please enter your password';
  return fields;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submit.disabled) return;

  const values = {
    username: form.elements.username.value.trim(),
    password: form.elements.password.value,
  };
  const fields = validate(values);
  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please fill in both fields.', fields });
    return;
  }

  clearFieldErrors(form);
  setBusy(submit, true, 'Logging in...');
  try {
    await login(values.username, values.password);
    window.location.href = ADMIN_HOME;
  } catch (error) {
    setBusy(submit, false);
    form.elements.password.value = '';
    showApiError(form, error);
  }
}

async function redirectIfLoggedIn() {
  try {
    await getMe();
    window.location.replace(ADMIN_HOME);
  } catch {
    form.elements.username.focus();
  }
}

form.addEventListener('submit', handleSubmit);
redirectIfLoggedIn();
