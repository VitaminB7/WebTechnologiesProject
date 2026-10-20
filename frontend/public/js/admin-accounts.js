// admin-accounts.js — สคริปต์หน้าจัดการบัญชีผู้ดูแล (admin/accounts.html) ใช้ได้เฉพาะ SuperAdmin
// หน้านี้มี 2 มุมมอง (ตาม Figma): ตารางผู้ดูแล  <->  ฟอร์มเพิ่ม/แก้ไขบัญชี
// ส่วนที่ 1: ตารางผู้ดูแล + ตัวกรอง 3 ช่อง (ชื่อ/Username, Role, Status)
// ส่วนที่ 2: ฟอร์มเพิ่ม/แก้ไข (ตอนแก้ไข ช่องรหัสผ่านเว้นว่าง = ใช้รหัสเดิม)

const ROLE_LABELS = { Admin: 'Admin', SuperAdmin: 'Super Admin' };
const STATUSES = ['Active', 'Inactive']; // Inactive = ปิดบัญชี ล็อกอินไม่ได้
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const FILTER_DELAY_MS = 300; // รอให้พิมพ์เสร็จก่อนค้นหา (มิลลิวินาที)

const filtersForm = document.getElementById('admin-filters');
const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const adminForm = document.getElementById('admin-form');
const saveButton = document.getElementById('form-save');

let currentAdmin = null;  // คนที่ล็อกอินอยู่
let editingAdmin = null;  // ผู้ดูแลที่กำลังแก้ไข (null = กำลังเพิ่มใหม่)
let latestListRequest = 0;
let filterTimer = null;

// แสดง "No permission" แทนเนื้อหาหน้า (สำหรับ Admin ธรรมดา)
function showNoPermission() {
  document.getElementById('page-content').classList.add('hidden');
  showState(document.getElementById('page-state'), 'error', 'Only super admins can manage user accounts.', 'No permission');
}

// ================= ส่วนที่ 1: ตาราง + ตัวกรอง =================

// ป้ายสถานะบัญชี (Active เขียว / Inactive เทา)
function statusPill(status) {
  if (status === 'Active') {
    return '<span class="account-status account-status--active">Active</span>';
  }
  return '<span class="account-status account-status--inactive">Inactive</span>';
}

// แถวในตาราง 1 แถว (ตัวเองลบตัวเองไม่ได้ จึงไม่มีปุ่ม Delete)
function adminRow(admin) {
  const name = escapeHtml(admin.username);
  let deleteButton = `<button type="button" class="btn btn--danger btn--delete" data-action="delete" data-username="${name}">Delete</button>`;
  let youText = '';
  if (admin.username === currentAdmin.username) {
    deleteButton = '';
    youText = ' <span class="muted">(you)</span>';
  }
  return `
    <tr>
      <td>${escapeHtml(admin.firstName)}</td>
      <td>${escapeHtml(admin.lastName)}</td>
      <td>${name}${youText}</td>
      <td>${escapeHtml(admin.email || '–')}</td>
      <td>${escapeHtml(ROLE_LABELS[admin.role] || admin.role)}</td>
      <td>${statusPill(admin.status)}</td>
      <td class="account-table__address">${escapeHtml(admin.address || '–')}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn--edit" data-action="edit" data-username="${name}">Edit</button>
          ${deleteButton}
        </div>
      </td>
    </tr>`;
}

// ผูกปุ่ม Edit / Delete ในตาราง
function bindRowButtons(tbody) {
  for (const button of tbody.querySelectorAll('button[data-action]')) {
    button.addEventListener('click', function () {
      const username = button.dataset.username;
      if (button.dataset.action === 'edit') {
        startEdit(username, button);
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
    status: filtersForm.elements.status.value,
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

// ลบผู้ดูแล: ถามยืนยันก่อน คืน true ถ้าลบสำเร็จ
async function removeAdmin(username, button) {
  if (!window.confirm('Delete administrator "' + username + '"? This cannot be undone.')) {
    return false;
  }
  button.disabled = true;
  try {
    await deleteAdmin(username);
    showToast('Administrator ' + username + ' deleted', 'success');
    loadAdmins();
    return true;
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
    return false;
  }
}

// ค้นหาใหม่หลังหยุดพิมพ์ 0.3 วินาที (ไม่ยิง API ทุกตัวอักษร)
function loadAdminsSoon() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadAdmins, FILTER_DELAY_MS);
}

// ผูกตัวกรอง: พิมพ์/เลือกแล้วค้นหาเลย (กด Enter ก็ได้)
function bindFilters() {
  filtersForm.addEventListener('submit', function (event) {
    event.preventDefault();
    loadAdmins();
  });
  filtersForm.elements.q.addEventListener('input', loadAdminsSoon);
  filtersForm.elements.role.addEventListener('change', loadAdmins);
  filtersForm.elements.status.addEventListener('change', loadAdmins);
}

// ================= ส่วนที่ 2: ฟอร์มเพิ่ม/แก้ไข =================

// เปิดฟอร์มแทนตาราง (admin = null คือเพิ่มใหม่, มีค่า = แก้ไขคนนั้น)
function openForm(admin) {
  adminForm.reset();
  clearFieldErrors(adminForm);
  editingAdmin = admin;
  const isEdit = Boolean(admin);
  document.getElementById('form-title').textContent = isEdit ? 'Edit account' : 'Add administrator';
  document.getElementById('form-lead').textContent = isEdit
    ? 'Edit account for a member of the administration team.'
    : 'Create an account for a member of the administration team.';
  saveButton.textContent = isEdit ? 'Save' : 'Create Account';
  adminForm.elements.username.readOnly = isEdit; // แก้ username ไม่ได้

  // ตอนแก้ไข รหัสผ่านไม่บังคับ (เว้นว่าง = ใช้รหัสเดิม)
  const passwordHint = isEdit ? 'Leave blank to keep the current password' : '********';
  adminForm.elements.password.placeholder = passwordHint;
  adminForm.elements.confirmPassword.placeholder = passwordHint;
  document.getElementById('password-star').classList.toggle('hidden', isEdit);
  document.getElementById('confirm-star').classList.toggle('hidden', isEdit);

  // ปิดบัญชีตัวเองไม่ได้ (API ตอบ 400) จึงล็อกช่อง Status ไว้ตอนแก้ไขตัวเอง
  const isSelf = isEdit && admin.username === currentAdmin.username;
  adminForm.elements.status.disabled = isSelf;

  const deleteButton = document.getElementById('form-delete');
  deleteButton.disabled = false;
  deleteButton.classList.toggle('hidden', !isEdit || admin.username === currentAdmin.username);

  if (isEdit) {
    adminForm.elements.username.value = admin.username;
    adminForm.elements.firstName.value = admin.firstName;
    adminForm.elements.lastName.value = admin.lastName;
    adminForm.elements.email.value = admin.email || '';
    adminForm.elements.confirmEmail.value = admin.email || '';
    adminForm.elements.address.value = admin.address || '';
    adminForm.elements.role.value = admin.role;
    adminForm.elements.status.value = admin.status;
  }
  listView.classList.add('hidden');
  formView.classList.remove('hidden');
  window.scrollTo({ top: 0 });
  adminForm.elements.firstName.focus({ preventScroll: true });
}

// ปิดฟอร์ม กลับไปหน้าตาราง
function closeForm() {
  editingAdmin = null;
  adminForm.reset();
  clearFieldErrors(adminForm);
  formView.classList.add('hidden');
  listView.classList.remove('hidden');
}

// กด Edit: โหลดข้อมูลล่าสุดของคนนั้นแล้วเปิดฟอร์ม
async function startEdit(username, button) {
  button.disabled = true;
  try {
    const admin = await getAdmin(username);
    openForm(admin);
  } catch (error) {
    showToast(error.message, 'error');
  }
  button.disabled = false;
}

// อ่านค่าทุกช่องในฟอร์ม
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
    status: fields.status.value,
    password: fields.password.value,
    confirmPassword: fields.confirmPassword.value,
  };
}

// ตรวจรหัสผ่าน: ตอนแก้ไขเว้นว่างได้ ถ้ากรอกต้องยาวพอและตรงกับช่องยืนยัน
function validatePassword(values, isEdit, fields) {
  if (isEdit && values.password === '' && values.confirmPassword === '') {
    return;
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    fields.password = 'Password must be at least ' + MIN_PASSWORD_LENGTH + ' characters';
  } else if (values.password !== values.confirmPassword) {
    fields.confirmPassword = 'Passwords do not match';
  }
}

// ตรวจฟอร์มก่อนส่ง (ช่องที่มี * ใน Figma ต้องกรอก, อีเมล/รหัสผ่านต้องตรงกับช่องยืนยัน)
function validateAdmin(values, isEdit) {
  const fields = {};
  if (!isEdit && !USERNAME_PATTERN.test(values.username)) {
    fields.username = 'Username must be 3-50 letters, digits, underscores or dots';
  }
  if (values.firstName === '') fields.firstName = 'First name is required';
  if (values.lastName === '') fields.lastName = 'Last name is required';
  if (!EMAIL_PATTERN.test(values.email)) {
    fields.email = 'Enter a valid email address';
  } else if (values.email !== values.confirmEmail) {
    fields.confirmEmail = 'Emails do not match';
  }
  if (!ROLE_LABELS[values.role]) fields.role = 'Choose a role';
  if (!STATUSES.includes(values.status)) fields.status = 'Choose Active or Inactive';
  if (values.address === '') fields.address = 'Address is required';
  validatePassword(values, isEdit, fields);
  return fields;
}

// ส่งข้อมูลไป API: เพิ่มใหม่ (createAdmin) หรือแก้ไข (updateAdmin)
// ตอนแก้ไขถ้าไม่กรอกรหัสผ่าน จะไม่ส่ง password = ใช้รหัสเดิม
async function sendAdmin(values) {
  const body = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    address: values.address,
    role: values.role,
    status: values.status,
  };
  if (values.password !== '') {
    body.password = values.password;
  }
  if (editingAdmin) {
    return await updateAdmin(editingAdmin.username, body);
  }
  body.username = values.username;
  return await createAdmin(body);
}

// กด Create Account / Save
async function saveAdmin(event) {
  event.preventDefault();
  if (saveButton.disabled) {
    return;
  }
  const values = readAdminForm();
  const fields = validateAdmin(values, Boolean(editingAdmin));
  if (Object.keys(fields).length > 0) {
    showApiError(adminForm, { message: 'Please fix the highlighted fields.', fields: fields });
    return;
  }

  clearFieldErrors(adminForm);
  setBusy(saveButton, true);
  try {
    await sendAdmin(values);
    showToast('Administrator ' + values.username + (editingAdmin ? ' updated' : ' created'), 'success');
    setBusy(saveButton, false);
    closeForm();
    loadAdmins();
  } catch (error) {
    setBusy(saveButton, false);
    showApiError(adminForm, error);
  }
}

// ปุ่ม Delete Account ในฟอร์มแก้ไข
async function deleteFromForm() {
  const button = document.getElementById('form-delete');
  const deleted = await removeAdmin(editingAdmin.username, button);
  if (deleted) {
    closeForm();
  }
}

// ================= เริ่มหน้า =================

// ผูกปุ่มของฟอร์ม
function bindForm() {
  document.getElementById('add-admin').addEventListener('click', function () {
    openForm(null);
  });
  document.getElementById('form-cancel').addEventListener('click', closeForm);
  document.getElementById('form-delete').addEventListener('click', deleteFromForm);
  adminForm.addEventListener('submit', saveAdmin);
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
  bindForm();
  document.getElementById('page-content').classList.remove('hidden');
  loadAdmins();
}

startAccountsPage();
