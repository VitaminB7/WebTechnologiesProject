// Admin "User management" (super_admin only): list/filter admins, add/edit panel, reset password, delete.
import {
  createAdmin, deleteAdmin, getAdmin, listAdmins, resetAdminPassword, updateAdmin,
} from '../api.js';
import { requireAdmin } from '../auth-guard.js';
import {
  clearFieldErrors, formatDate, h, renderAdminHeader, renderFooter, renderState, setBusy,
  showApiError, showToast,
} from '../ui.js';

const ROLE_LABELS = { super_admin: 'Super admin', listing_admin: 'Listing admin', operations: 'Operations' };
const STATUSES = ['active', 'inactive'];
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

function statusBadge(status) {
  const active = status === 'active';
  return h('span', { className: `badge ${active ? 'badge--available' : 'badge--inactive'}`, text: active ? 'Active' : 'Inactive' });
}

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
    h('td', {}, [statusBadge(admin.status)]),
    h('td', { text: formatDate(admin.updatedAt) }),
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
    status: filtersForm.elements.status.value,
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
  filtersForm.elements.status.addEventListener('change', loadAdmins);
}

// ================= Add / Edit panel =================

function openPanel(admin) {
  form.reset();
  clearFieldErrors(form);
  editing = admin;
  const isEdit = Boolean(admin);
  $('panel-title').textContent = isEdit ? `Edit administrator: ${admin.username}` : 'Add administrator';
  form.elements.username.readOnly = isEdit;
  form.elements.password.disabled = isEdit;
  $('password-field').classList.toggle('hidden', isEdit);
  $('panel-reset-password').classList.toggle('hidden', !isEdit);
  if (isEdit) {
    form.elements.username.value = admin.username;
    form.elements.firstName.value = admin.firstName;
    form.elements.lastName.value = admin.lastName;
    form.elements.emails.value = (admin.emails || []).join(', ');
    form.elements.role.value = admin.role;
    form.elements.status.value = admin.status;
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

function parseEmails(text) {
  return [...new Set(text.split(/[,\s]+/).filter(Boolean))];
}

function readAdminForm() {
  const fields = form.elements;
  return {
    username: fields.username.value.trim(),
    firstName: fields.firstName.value.trim(),
    lastName: fields.lastName.value.trim(),
    emails: parseEmails(fields.emails.value),
    role: fields.role.value,
    status: fields.status.value,
    password: fields.password.value,
  };
}

function validateAdmin(values, isEdit) {
  const fields = {};
  if (!values.username) fields.username = 'Username is required';
  if (!values.firstName) fields.firstName = 'First name is required';
  if (!values.lastName) fields.lastName = 'Last name is required';
  const badEmail = values.emails.find((email) => !EMAIL_PATTERN.test(email));
  if (badEmail) fields.emails = `"${badEmail}" is not a valid email address`;
  if (!ROLE_LABELS[values.role]) fields.role = 'Choose a role';
  if (!STATUSES.includes(values.status)) fields.status = 'Choose a status';
  if (!isEdit && values.password.length < MIN_PASSWORD_LENGTH) {
    fields.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return fields;
}

function saveRequest(values) {
  const { username, password, ...profile } = values;
  if (!editing) return createAdmin({ username, password, ...profile });
  // PUT is a full update: keep the address we do not edit here; omit password to keep it.
  return updateAdmin(editing.username, { ...profile, address: editing.address ?? null });
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
  if (currentAdmin.role !== 'super_admin') {
    showNoPermission();
  } else {
    bindFilters();
    bindPanel();
    $('page-content').classList.remove('hidden');
    loadAdmins();
  }
}
