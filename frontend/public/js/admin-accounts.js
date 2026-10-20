// admin-accounts.js — สคริปต์หน้าจัดการบัญชีผู้ดูแล (admin/accounts.html) ใช้ได้เฉพาะ SuperAdmin
// ส่วนที่ 1: ตารางผู้ดูแล + ตัวกรอง 3 ช่อง (Username/name, Role, Email)
// ส่วนที่ 2: แผงเพิ่ม/แก้ไขผู้ดูแล
// ส่วนที่ 3: หน้าต่างรีเซ็ตรหัสผ่าน

const ROLE_LABELS = { Admin: 'Admin', SuperAdmin: 'Super admin' };
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const FILTER_DELAY_MS = 300; // รอให้พิมพ์เสร็จก่อนค้นหา (มิลลิวินาที)

const filtersForm = document.getElementById('admin-filters');
const adminPanel = document.getElementById('admin-panel');
const adminForm = document.getElementById('admin-form');
const panelSaveButton = document.getElementById('panel-save');
const resetDialog = document.getElementById('reset-dialog');
const resetForm = document.getElementById('reset-form');

let currentAdmin = null;  // คนที่ล็อกอินอยู่
let editingAdmin = null;  // ผู้ดูแลที่กำลังแก้ไข (null = กำลังเพิ่มใหม่)
let resetUsername = null; // ผู้ดูแลที่กำลังรีเซ็ตรหัส
let latestListRequest = 0;
let filterTimer = null;

// แสดง "No permission" แทนเนื้อหาหน้า (สำหรับ Admin ธรรมดา)
function showNoPermission() {
  document.getElementById('page-content').classList.add('hidden');
  showState(document.getElementById('page-state'), 'error', 'Only super admins can manage user accounts.', 'No permission');
}

// ================= ส่วนที่ 1: ตาราง + ตัวกรอง =================

// แถวในตาราง 1 แถว (ตัวเองลบตัวเองไม่ได้ จึงไม่มีปุ่ม Delete)
function adminRow(admin) {
  const isSelf = admin.username === currentAdmin.username;
  const name = escapeHtml(admin.username);
  let youText = '';
  let deleteButton = `<button type="button" class="btn btn--sm btn--danger-outline" data-action="delete" data-username="${name}">Delete</button>`;
  if (isSelf) {
    youText = '<span class="muted"> (you)</span>';
    deleteButton = '';
  }
  return `
    <tr>
      <td><strong>${name}</strong>${youText}</td>
      <td>${escapeHtml(admin.displayName)}</td>
      <td>${escapeHtml(ROLE_LABELS[admin.role] || admin.role)}</td>
      <td>${escapeHtml(admin.email || '–')}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn--sm btn--outline" data-action="edit" data-username="${name}">Edit</button>
          <button type="button" class="btn btn--sm btn--outline" data-action="reset" data-username="${name}">Reset password</button>
          ${deleteButton}
        </div>
      </td>
    </tr>`;
}

// ผูกปุ่ม Edit / Reset password / Delete ในตาราง
function bindRowButtons(tbody) {
  for (const button of tbody.querySelectorAll('button[data-action]')) {
    button.addEventListener('click', function () {
      const username = button.dataset.username;
      if (button.dataset.action === 'edit') {
        startEdit(username, button);
      } else if (button.dataset.action === 'reset') {
        openResetDialog(username);
      } else {
        removeAdmin(username, button);
      }
    });
  }
}

// อ่านตัวกรอง 3 ช่อง (ช่องว่าง api.js จะไม่ส่งไป)
function readFilters() {
  return {
    q: filtersForm.elements.q.value.trim(),
    role: filtersForm.elements.role.value,
    email: filtersForm.elements.email.value.trim(),
  };
}

// โหลดรายชื่อผู้ดูแลตามตัวกรอง แล้ววาดตาราง
async function loadAdmins() {
  latestListRequest = latestListRequest + 1;
  const requestId = latestListRequest;
  const tbody = document.getElementById('admins-body');
  const stateBox = document.getElementById('admins-state');
  tbody.innerHTML = '';
  document.getElementById('admins-count').textContent = '';
  showState(stateBox, 'loading', 'Loading administrators...');
  try {
    const admins = await listAdmins(readFilters());
    if (requestId !== latestListRequest) {
      return;
    }
    let html = '';
    for (const admin of admins) {
      html += adminRow(admin);
    }
    tbody.innerHTML = html;
    bindRowButtons(tbody);
    document.getElementById('admins-count').textContent = admins.length + ' administrator(s)';
    if (admins.length > 0) {
      stateBox.innerHTML = '';
    } else {
      showState(stateBox, 'empty', 'No administrators match these filters.');
    }
  } catch (error) {
    if (requestId !== latestListRequest) {
      return;
    }
    if (error.status === 403) {
      showNoPermission();
    } else {
      showState(stateBox, 'error', error.message, 'Could not load administrators');
    }
  }
}

// กด Delete: ถามยืนยันก่อน แล้วลบ
async function removeAdmin(username, button) {
  if (!window.confirm('Delete administrator "' + username + '"? This cannot be undone.')) {
    return;
  }
  button.disabled = true;
  try {
    await deleteAdmin(username);
    showToast('Administrator ' + username + ' deleted', 'success');
    if (editingAdmin && editingAdmin.username === username) {
      closePanel();
    }
    loadAdmins();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

// ค้นหาใหม่หลังหยุดพิมพ์ 0.3 วินาที (ไม่ยิง API ทุกตัวอักษร)
function loadAdminsSoon() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadAdmins, FILTER_DELAY_MS);
}

// ผูกตัวกรอง: พิมพ์/เลือกแล้วค้นหาเลย, กด Search ก็ได้, กด Clear ล้างทั้งหมด
function bindFilters() {
  filtersForm.addEventListener('submit', function (event) {
    event.preventDefault();
    loadAdmins();
  });
  filtersForm.addEventListener('reset', function () {
    setTimeout(loadAdmins, 0); // รอให้ฟอร์มล้างค่าเสร็จก่อน
  });
  filtersForm.elements.q.addEventListener('input', loadAdminsSoon);
  filtersForm.elements.email.addEventListener('input', loadAdminsSoon);
  filtersForm.elements.role.addEventListener('change', loadAdmins);
}

// ================= ส่วนที่ 2: แผงเพิ่ม/แก้ไข =================

// ซ่อน/แสดงช่องรหัสผ่าน (มีเฉพาะตอนเพิ่มใหม่ ตอนแก้ไขใช้ปุ่ม Reset password แทน)
function showPasswordFields(show) {
  for (const field of adminForm.querySelectorAll('.password-field')) {
    if (show) {
      field.classList.remove('hidden');
    } else {
      field.classList.add('hidden');
    }
    field.querySelector('input').disabled = !show;
  }
}

// เปิดแผง (admin = null คือเพิ่มใหม่, มีค่า = แก้ไขคนนั้น)
function openPanel(admin) {
  adminForm.reset();
  clearFieldErrors(adminForm);
  editingAdmin = admin;
  const isEdit = Boolean(admin);
  document.getElementById('panel-title').textContent = isEdit ? 'Edit administrator: ' + admin.username : 'Add administrator';
  adminForm.elements.username.readOnly = isEdit; // แก้ username ไม่ได้
  showPasswordFields(!isEdit);
  const resetButton = document.getElementById('panel-reset-password');
  if (isEdit) {
    resetButton.classList.remove('hidden');
    adminForm.elements.username.value = admin.username;
    adminForm.elements.firstName.value = admin.firstName;
    adminForm.elements.lastName.value = admin.lastName;
    adminForm.elements.email.value = admin.email || '';
    adminForm.elements.confirmEmail.value = admin.email || '';
    adminForm.elements.address.value = admin.address || '';
    adminForm.elements.role.value = admin.role;
  } else {
    resetButton.classList.add('hidden');
  }
  adminPanel.classList.remove('hidden');
  adminPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  adminForm.elements[isEdit ? 'firstName' : 'username'].focus({ preventScroll: true });
}

// ปิดแผงและล้างฟอร์ม
function closePanel() {
  editingAdmin = null;
  adminForm.reset();
  clearFieldErrors(adminForm);
  adminPanel.classList.add('hidden');
}

// กด Edit: โหลดข้อมูลล่าสุดของคนนั้นแล้วเปิดแผง
async function startEdit(username, button) {
  button.disabled = true;
  try {
    const admin = await getAdmin(username);
    openPanel(admin);
  } catch (error) {
    showToast(error.message, 'error');
  }
  button.disabled = false;
}

// อ่านค่าทุกช่องในแผง
function readAdminForm() {
  const fields = adminForm.elements;
  return {
    username: fields.username.value.trim(),
    firstName: fields.firstName.value.trim(),
    lastName: fields.lastName.value.trim(),
    email: fields.email.value.trim(),
    confirmEmail: fields.confirmEmail.value.trim(),
    address: fields.address.value.trim(),
    role: fields.role.value,
    password: fields.password.value,
    confirmPassword: fields.confirmPassword.value,
  };
}

// ตรวจแผงก่อนส่ง (อีเมลกับยืนยันอีเมลต้องตรงกัน, รหัสผ่านกับยืนยันต้องตรงกัน)
function validateAdmin(values, isEdit) {
  const fields = {};
  if (!isEdit && !USERNAME_PATTERN.test(values.username)) {
    fields.username = 'Username must be 3-50 letters, digits, underscores or dots';
  }
  if (values.firstName === '') fields.firstName = 'First name is required';
  if (values.lastName === '') fields.lastName = 'Last name is required';
  if (values.email !== '' && !EMAIL_PATTERN.test(values.email)) {
    fields.email = 'Enter a valid email address';
  } else if (values.email !== values.confirmEmail) {
    fields.confirmEmail = 'Emails do not match';
  }
  if (!ROLE_LABELS[values.role]) fields.role = 'Choose a role';
  if (!isEdit) {
    if (values.password.length < MIN_PASSWORD_LENGTH) {
      fields.password = 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters';
    } else if (values.password !== values.confirmPassword) {
      fields.confirmPassword = 'Passwords do not match';
    }
  }
  return fields;
}

// ส่งข้อมูลไป API: เพิ่มใหม่ (createAdmin) หรือแก้ไข (updateAdmin)
// ตอนแก้ไขไม่ส่ง password = ใช้รหัสเดิม (เปลี่ยนรหัสผ่านปุ่ม Reset password)
async function sendAdmin(values) {
  const body = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email || null,
    address: values.address || null,
    role: values.role,
  };
  if (editingAdmin) {
    return await updateAdmin(editingAdmin.username, body);
  }
  body.username = values.username;
  body.password = values.password;
  return await createAdmin(body);
}

// กด Save changes
async function saveAdmin(event) {
  event.preventDefault();
  if (panelSaveButton.disabled) {
    return;
  }
  const values = readAdminForm();
  const fields = validateAdmin(values, Boolean(editingAdmin));
  if (Object.keys(fields).length > 0) {
    showApiError(adminForm, { message: 'Please fix the highlighted fields.', fields: fields });
    return;
  }

  clearFieldErrors(adminForm);
  setBusy(panelSaveButton, true);
  try {
    await sendAdmin(values);
    showToast('Administrator ' + values.username + (editingAdmin ? ' updated' : ' created'), 'success');
    closePanel();
    loadAdmins();
  } catch (error) {
    showApiError(adminForm, error);
  }
  setBusy(panelSaveButton, false);
}

// ================= ส่วนที่ 3: รีเซ็ตรหัสผ่าน =================

// เปิดหน้าต่างรีเซ็ตรหัสของ username
function openResetDialog(username) {
  resetUsername = username;
  resetForm.reset();
  clearFieldErrors(resetForm);
  document.getElementById('reset-for').textContent = 'Set a new password for ' + username + '.';
  resetDialog.showModal();
  resetForm.elements.password.focus();
}

// กดยืนยันรีเซ็ตรหัส
async function submitReset(event) {
  event.preventDefault();
  const submit = document.getElementById('reset-save');
  if (submit.disabled) {
    return;
  }
  const password = resetForm.elements.password.value;
  const fields = {};
  if (password.length < MIN_PASSWORD_LENGTH) {
    fields.password = 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters';
  } else if (password !== resetForm.elements.confirm.value) {
    fields.confirm = 'Passwords do not match';
  }
  if (Object.keys(fields).length > 0) {
    showApiError(resetForm, { message: '', fields: fields });
    return;
  }

  setBusy(submit, true);
  try {
    await resetAdminPassword(resetUsername, password);
    resetDialog.close();
    showToast('Password for ' + resetUsername + ' was reset', 'success');
  } catch (error) {
    showApiError(resetForm, error);
  }
  setBusy(submit, false);
}

// ================= เริ่มหน้า =================

// ผูกปุ่มของแผงและหน้าต่างรีเซ็ตรหัส
function bindPanel() {
  document.getElementById('add-admin').addEventListener('click', function () {
    openPanel(null);
  });
  document.getElementById('panel-cancel').addEventListener('click', closePanel);
  document.getElementById('panel-reset-password').addEventListener('click', function () {
    openResetDialog(editingAdmin.username);
  });
  adminForm.addEventListener('submit', saveAdmin);
  resetForm.addEventListener('submit', submitReset);
  document.getElementById('reset-cancel').addEventListener('click', function () {
    resetDialog.close();
  });
}

// ตรวจการล็อกอิน -> Admin ธรรมดาเห็น "No permission", SuperAdmin เห็นหน้าเต็ม
async function startAccountsPage() {
  currentAdmin = await requireAdmin(document.getElementById('page-state'));
  if (!currentAdmin) {
    return;
  }
  setupAdminHeader(currentAdmin);
  if (currentAdmin.role !== 'SuperAdmin') {
    showNoPermission();
    return;
  }
  bindFilters();
  bindPanel();
  document.getElementById('page-content').classList.remove('hidden');
  loadAdmins();
}

startAccountsPage();
