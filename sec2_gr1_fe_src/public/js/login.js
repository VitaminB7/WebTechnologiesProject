// login.js — สคริปต์หน้า login: ตรวจช่องว่าง ส่ง username/password ไป API แล้วไปหน้าจัดการห้อง

const ADMIN_HOME = '/admin/rooms.html';
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-submit');

// ตรวจว่ากรอกครบทั้ง 2 ช่อง คืน object ข้อความผิด (ว่าง = ผ่าน)
function validateLogin(username, password) {
  const fields = {};
  if (username === '') {
    fields.username = 'Please enter your username or email';
  }
  if (password === '') {
    fields.password = 'Please enter your password';
  }
  return fields;
}

// กดปุ่ม Login
async function handleLogin(event) {
  event.preventDefault();
  if (loginButton.disabled) {
    return;
  }
  const username = loginForm.elements.username.value.trim();
  const password = loginForm.elements.password.value;

  const fields = validateLogin(username, password);
  if (Object.keys(fields).length > 0) {
    showApiError(loginForm, { message: 'Please fill in both fields.', fields: fields });
    return;
  }

  clearFieldErrors(loginForm);
  setBusy(loginButton, true, 'Logging in...');
  try {
    await login(username, password);
    window.location.href = ADMIN_HOME;
  } catch (error) {
    // รหัสผิด -> แสดงข้อความจาก API ใต้ฟอร์ม และล้างช่องรหัสผ่าน
    setBusy(loginButton, false);
    loginForm.elements.password.value = '';
    showApiError(loginForm, error);
  }
}

// ถ้าล็อกอินอยู่แล้ว ไม่ต้องกรอกใหม่ ส่งไปหน้าแอดมินเลย
async function redirectIfLoggedIn() {
  try {
    await getMe();
    window.location.replace(ADMIN_HOME);
  } catch (error) {
    loginForm.elements.username.focus();
  }
}

loginForm.addEventListener('submit', handleLogin);
redirectIfLoggedIn();
