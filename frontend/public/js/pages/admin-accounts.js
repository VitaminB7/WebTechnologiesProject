// Admin "User management" (SuperAdmin only): list/filter admins, add/edit panel, reset password, delete.
import {
  createAdmin, deleteAdmin, getAdmin, listAdmins, resetAdminPassword, updateAdmin,
} from '../api.js';
import { requireAdmin } from '../auth-guard.js';
import {
  clearFieldErrors, h, renderAdminHeader, renderFooter, renderState, setBusy,
  showApiError, showToast,
} from '../ui.js';

const ROLE_LABELS = { Admin: 'Admin', SuperAdmin: 'Super admin' };
const SUPER_ADMIN = 'SuperAdmin';
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,50}$/;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FILTER_DELAY_MS = 300;

const $ = (id) => document.getElementById(id);
const filtersForm = $('admin-filters');
const panel = $('admin-panel');
const form = $('admin-form');
const saveButton = $('panel-save');
const resetDialog = $('reset-dialog');
const resetForm = $('reset-form');

let currentAdmin = null;
let editing = null; // Admin loaded into the panel, null = adding
let resetTarget = null;
let latestListRequest = 0;
let filterTimer = null;

function showNoPermission() {
  $('page-content').classList.add('hidden');
  renderState($('page-state'), 'error', 'Only super admins can manage user accounts.', 'No permission');
}

// ================= Table =================

function actionButton(label, className, onClick) {
  const button = h('button', { type: 'button', className: `btn btn--sm ${className}`, text: label });
  button.addEventListener('click', () => onClick(button));
  return button;
}

function adminRow(admin) {
  const isSelf = currentAdmin && admin.username === currentAdmin.username;
  return h('tr', {}, [
    h('td', {}, [h('strong', { text: admin.username }), isSelf ? h('span', { className: 'muted', text: ' (you)' }) : null]),
    h('td', { text: admin.displayName }),
    h('td', { text: ROLE_LABELS[admin.role] || admin.role }),
    h('td', { text: admin.email || '–' }),
    h('td', {}, [h('div', { className: 'row-actions' }, [
      actionButton('Edit', 'btn--outline', (button) => startEdit(admin.username, button)),
      actionButton('Reset password', 'btn--outline', () => openResetDialog(admin.username)),
      isSelf ? null : actionButton('Delete', 'btn--danger-outline', (button) => removeAdmin(admin.username, button)),
    ])]),
  ]);
}

function readFilters() {
  return {
    q: filtersForm.elements.q.value.trim(),
    role: filtersForm.elements.role.value,
  };
}

async function loadAdmins() {
  const requestId = ++latestListRequest;
  $('admins-body').replaceChildren();
  $('admins-count').textContent = '';
  renderState($('admins-state'), 'loading', 'Loading administrators...');
  try {
    const admins = await listAdmins(readFilters());
    if (requestId !== latestListRequest) return;
    $('admins-body').replaceChildren(...admins.map(adminRow));
    $('admins-count').textContent = `${admins.length} administrator(s)`;
    if (admins.length) $('admins-state').replaceChildren();
    else renderState($('admins-state'), 'empty', 'No administrators match these filters.');
  } catch (error) {
    if (requestId !== latestListRequest) return;
    if (error.status === 403) showNoPermission();
    else renderState($('admins-state'), 'error', error.message, 'Could not load administrators');
  }
}

async function removeAdmin(username, button) {
  if (!window.confirm(`Delete administrator "${username}"? This cannot be undone.`)) return;
  button.disabled = true;
  try {
    await deleteAdmin(username);
    showToast(`Administrator ${username} deleted`, 'success');
    if (editing && editing.username === username) closePanel();
    loadAdmins();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

function bindFilters() {
  filtersForm.addEventListener('submit', (event) => event.preventDefault());
  filtersForm.elements.q.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(loadAdmins, FILTER_DELAY_MS);
  });
  filtersForm.elements.role.addEventListener('change', loadAdmins);
}

// ================= Add / Edit panel =================

function openPanel(admin) {
  form.reset();
  clearFieldErrors(form);
  editing = admin;
  const isEdit = Boolean(admin);
  $('panel-title').textContent = isEdit ? `Edit administrator: ${admin.username}` : 'Add administrator';
  form.elements.username.readOnly = isEdit;
  form.querySelectorAll('.password-field').forEach((field) => {
    field.classList.toggle('hidden', isEdit);
    field.querySelector('input').disabled = isEdit;
  });
  $('panel-reset-password').classList.toggle('hidden', !isEdit);
  if (isEdit) {
    form.elements.username.value = admin.username;
    form.elements.firstName.value = admin.firstName;
    form.elements.lastName.value = admin.lastName;
    form.elements.email.value = admin.email || '';
    form.elements.confirmEmail.value = admin.email || '';
    form.elements.address.value = admin.address || '';
    form.elements.role.value = admin.role;
  }
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements[isEdit ? 'firstName' : 'username'].focus({ preventScroll: true });
}

function closePanel() {
  editing = null;
  form.reset();
  clearFieldErrors(form);
  panel.classList.add('hidden');
}

async function startEdit(username, button) {
  button.disabled = true;
  try {
    openPanel(await getAdmin(username));
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function readAdminForm() {
  const fields = form.elements;
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

function validateAdmin(values, isEdit) {
  const fields = {};
  if (!isEdit && !USERNAME_PATTERN.test(values.username)) {
    fields.username = 'Username must be 3-50 letters, digits, underscores or dots';
  }
  if (!values.firstName) fields.firstName = 'First name is required';
  if (!values.lastName) fields.lastName = 'Last name is required';
  if (values.email && !EMAIL_PATTERN.test(values.email)) fields.email = 'Enter a valid email address';
  else if (values.email !== values.confirmEmail) fields.confirmEmail = 'Emails do not match';
  if (!ROLE_LABELS[values.role]) fields.role = 'Choose a role';
  if (isEdit) return fields;
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    fields.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  } else if (values.password !== values.confirmPassword) {
    fields.confirmPassword = 'Passwords do not match';
  }
  return fields;
}

function saveRequest(values) {
  const profile = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email || null,
    address: values.address || null,
    role: values.role,
  };
  if (!editing) return createAdmin({ username: values.username, password: values.password, ...profile });
  // Password is left out on purpose: blank = keep (it is changed through "Reset password").
  return updateAdmin(editing.username, profile);
}

async function saveAdmin(event) {
  event.preventDefault();
  if (saveButton.disabled) return;
  const values = readAdminForm();
  const fields = validateAdmin(values, Boolean(editing));
  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please fix the highlighted fields.', fields });
    return;
  }

  clearFieldErrors(form);
  setBusy(saveButton, true);
  try {
    await saveRequest(values);
    showToast(`Administrator ${values.username} ${editing ? 'updated' : 'created'}`, 'success');
    closePanel();
    loadAdmins();
  } catch (error) {
    showApiError(form, error);
  } finally {
    setBusy(saveButton, false);
  }
}

// ================= Reset password dialog =================

function openResetDialog(username) {
  resetTarget = username;
  resetForm.reset();
  clearFieldErrors(resetForm);
  $('reset-for').textContent = `Set a new password for ${username}.`;
  resetDialog.showModal();
  resetForm.elements.password.focus();
}

async function submitReset(event) {
  event.preventDefault();
  const submit = $('reset-save');
  if (submit.disabled) return;
  const password = resetForm.elements.password.value;
  const fields = {};
  if (password.length < MIN_PASSWORD_LENGTH) fields.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  else if (password !== resetForm.elements.confirm.value) fields.confirm = 'Passwords do not match';
  if (Object.keys(fields).length) {
    showApiError(resetForm, { message: '', fields });
    return;
  }

  setBusy(submit, true);
  try {
    await resetAdminPassword(resetTarget, password);
    resetDialog.close();
    showToast(`Password for ${resetTarget} was reset`, 'success');
  } catch (error) {
    showApiError(resetForm, error);
  } finally {
    setBusy(submit, false);
  }
}

function bindPanel() {
  $('add-admin').addEventListener('click', () => openPanel(null));
  $('panel-cancel').addEventListener('click', closePanel);
  $('panel-reset-password').addEventListener('click', () => openResetDialog(editing.username));
  form.addEventListener('submit', saveAdmin);
  resetForm.addEventListener('submit', submitReset);
  $('reset-cancel').addEventListener('click', () => resetDialog.close());
}

// ================= Init =================

renderAdminHeader('accounts', null);
renderFooter('admin');
currentAdmin = await requireAdmin($('page-state'));
if (currentAdmin) {
  renderAdminHeader('accounts', currentAdmin);
  if (currentAdmin.role !== SUPER_ADMIN) {
    showNoPermission();
  } else {
    bindFilters();
    bindPanel();
    $('page-content').classList.remove('hidden');
    loadAdmins();
  }
}
