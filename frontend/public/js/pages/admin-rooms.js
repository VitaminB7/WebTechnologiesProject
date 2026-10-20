// Admin "Product management": room table (search + pagination) and the Add/Edit room form.
import { createRoom, deleteRoom, getRoom, listRooms, updateRoom } from '../api.js';
import { requireAdmin } from '../auth-guard.js';
import {
  APPLIANCES, ROOM_TYPES, availabilityBadge, clearFieldErrors, formatPrice, h, rangeText,
  renderAdminHeader, renderFooter, renderPagination, renderState, setBusy, showApiError, showToast,
} from '../ui.js';

const PAGE_SIZE = 6;
const ROOM_ID_PATTERN = /^L-\d{4}$/;
const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// API error keys for appliances are positional (`appliances.0.serialNumber`), see mapApplianceErrors.
const APPLIANCE_ERROR_KEY = /^appliances\.(\d+)\.(serialNumber|name)$/;

const $ = (id) => document.getElementById(id);
const form = $('room-form');
const saveButton = $('room-save');

const listState = { q: '', type: '', available: '', page: 1 };
let editingRoom = null; // room loaded into the form, null = add mode
let latestListRequest = 0;

// ================= Room table =================

function roomRow(room) {
  const editButton = h('button', { type: 'button', className: 'icon-btn', text: '✎', title: 'Edit', 'aria-label': `Edit room ${room.roomId}` });
  const deleteButton = h('button', { type: 'button', className: 'icon-btn icon-btn--danger', text: '🗑', title: 'Delete', 'aria-label': `Delete room ${room.roomId}` });
  editButton.addEventListener('click', () => startEdit(room.roomId, editButton));
  deleteButton.addEventListener('click', () => removeRoom(room, deleteButton));

  return h('tr', {}, [
    h('td', {}, [h('strong', { text: room.roomId })]),
    h('td', {}, [h('span', { className: 'badge badge--type', text: room.roomType })]),
    h('td', { text: formatPrice(room.price) }),
    h('td', {}, [availabilityBadge(room.available)]),
    h('td', {}, [h('div', { className: 'row-actions' }, [editButton, deleteButton])]),
  ]);
}

function renderRooms(rooms, meta) {
  $('rooms-body').replaceChildren(...rooms.map(roomRow));
  $('rooms-range').textContent = rangeText(meta, rooms.length, 'rooms');
  renderPagination($('rooms-pagination'), meta, (page) => {
    listState.page = page;
    loadRooms();
  });
  if (rooms.length) $('rooms-state').replaceChildren();
  else renderState($('rooms-state'), 'empty', 'No rooms match this search.');
}

async function loadRooms() {
  const requestId = ++latestListRequest;
  $('rooms-body').replaceChildren();
  $('rooms-range').textContent = '';
  renderState($('rooms-state'), 'loading', 'Loading rooms...');
  try {
    const { q, type, available, page } = listState;
    const { data, meta } = await listRooms({ q, type, available, page, pageSize: PAGE_SIZE });
    if (requestId !== latestListRequest) return;
    const lastPage = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
    if (!data.length && page > lastPage) {
      listState.page = lastPage; // e.g. the last row of the last page was just deleted
      loadRooms();
      return;
    }
    renderRooms(data, meta);
  } catch (error) {
    if (requestId === latestListRequest) renderState($('rooms-state'), 'error', error.message, 'Could not load rooms');
  }
}

async function removeRoom(room, button) {
  if (!window.confirm(`Delete room ${room.roomId}? Its appliances will be deleted too. This cannot be undone.`)) return;
  button.disabled = true;
  try {
    await deleteRoom(room.roomId);
    showToast(`Room ${room.roomId} deleted`, 'success');
    if (editingRoom && editingRoom.roomId === room.roomId) resetEditor();
    loadRooms();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

async function startEdit(roomId, button) {
  button.disabled = true;
  try {
    fillEditor(await getRoom(roomId));
    $('room-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function bindSearchCard() {
  const searchForm = $('room-search');
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    Object.assign(listState, {
      q: searchForm.elements.q.value.trim(),
      type: searchForm.elements.type.value,
      available: searchForm.elements.available.value,
      page: 1,
    });
    loadRooms();
  });
  searchForm.addEventListener('reset', () => {
    Object.assign(listState, { q: '', type: '', available: '', page: 1 });
    loadRooms();
  });
}

// ================= Appliances =================

const applianceBoxes = () => [...form.querySelectorAll('input[name="appliance"]')];
const serialInput = (box) => form.elements[box.dataset.serialName];

/** Ticked appliances in the order they are sent, so API error index N = tickedBoxes()[N]. */
const tickedBoxes = () => applianceBoxes().filter((box) => box.checked);

/** A serial number is only editable (and required) while its appliance is ticked. */
function syncSerialInputs() {
  for (const box of applianceBoxes()) serialInput(box).disabled = !box.checked;
}

function renderApplianceOptions() {
  $('appliance-options').replaceChildren(...APPLIANCES.map((name, index) => {
    const id = `appliance-${index}`;
    const serialName = `serial-${index}`;
    const box = h('input', { type: 'checkbox', id, name: 'appliance', value: name, 'data-serial-name': serialName });
    box.addEventListener('change', syncSerialInputs);
    return h('div', { className: 'field appliance-option' }, [
      h('label', { for: id }, [box, name]),
      h('input', {
        type: 'text', name: serialName, maxlength: '50', placeholder: 'Serial number',
        autocomplete: 'off', 'aria-label': `${name} serial number`,
      }),
    ]);
  }));
}

function fillAppliances(appliances = []) {
  for (const box of applianceBoxes()) {
    const match = appliances.find((appliance) => appliance.name === box.value);
    box.checked = Boolean(match);
    serialInput(box).value = match ? match.serialNumber : '';
  }
  syncSerialInputs();
}

function readAppliances() {
  return tickedBoxes().map((box) => ({ serialNumber: serialInput(box).value.trim(), name: box.value }));
}

function validateAppliances(appliances, fields) {
  const boxes = tickedBoxes();
  const seen = new Set();
  appliances.forEach((appliance, index) => {
    const key = boxes[index].dataset.serialName;
    if (!appliance.serialNumber) fields[key] = `Serial number is required for ${appliance.name}`;
    else if (seen.has(appliance.serialNumber)) fields[key] = 'This serial number is already used in this room';
    seen.add(appliance.serialNumber);
  });
}

/** Re-key `appliances.N.*` API errors onto the serial input of the N-th ticked appliance. */
function mapApplianceErrors(error, sentBoxes) {
  const fields = {};
  for (const [key, message] of Object.entries(error.fields || {})) {
    const match = APPLIANCE_ERROR_KEY.exec(key);
    const box = match && sentBoxes[Number(match[1])];
    fields[box ? box.dataset.serialName : key] = message;
  }
  return { message: error.message, fields };
}

// ================= Add / Edit form =================

function setMode(room) {
  editingRoom = room;
  const tabAdd = $('tab-add');
  const tabEdit = $('tab-edit');
  tabAdd.setAttribute('aria-selected', String(!room));
  tabEdit.setAttribute('aria-selected', String(Boolean(room)));
  tabEdit.disabled = !room;
  tabEdit.textContent = room ? `Edit Room ${room.roomId}` : 'Edit Room';
  form.elements.roomId.readOnly = Boolean(room);
}

function resetEditor() {
  form.reset();
  syncSerialInputs();
  clearFieldErrors(form);
  setMode(null);
}

function fillEditor(room) {
  resetEditor();
  const fields = form.elements;
  for (const name of ['roomId', 'building', 'roomType', 'size', 'price', 'bedrooms', 'minimumLease']) {
    fields[name].value = room[name] ?? '';
  }
  fields.available.value = String(Boolean(room.available));
  fields.description.value = room.description || '';
  const owner = room.owner || {};
  for (const key of ['name', 'phone', 'email', 'lineId']) fields[`owner.${key}`].value = owner[key] || '';
  fillAppliances(room.appliances);
  setMode(room);
}

function readRoomForm() {
  const fields = form.elements;
  const number = (name) => (fields[name].value.trim() === '' ? null : Number(fields[name].value));
  const optional = (name) => fields[name].value.trim() || null;
  return {
    roomId: editingRoom ? editingRoom.roomId : fields.roomId.value.trim(),
    building: fields.building.value.trim(),
    roomType: fields.roomType.value,
    bedrooms: number('bedrooms'),
    size: number('size'),
    price: number('price'),
    description: optional('description'),
    minimumLease: number('minimumLease'),
    available: fields.available.value === 'true',
    appliances: readAppliances(),
    owner: {
      name: fields['owner.name'].value.trim(),
      phone: fields['owner.phone'].value.trim(),
      email: optional('owner.email'),
      lineId: optional('owner.lineId'),
    },
  };
}

const isIntBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const isBetween = (value, min, max) => value !== null && value >= min && value <= max;

/** Same rules as the Room table in API.md. */
function validateRoom(room) {
  const fields = {};
  if (!ROOM_ID_PATTERN.test(room.roomId)) fields.roomId = 'Room ID must look like L-1203 (L- and 4 digits)';
  if (!room.building) fields.building = 'Building is required';
  if (!ROOM_TYPES.includes(room.roomType)) fields.roomType = 'Choose a room type';
  if (!isIntBetween(room.bedrooms, 0, 10)) fields.bedrooms = 'Bedrooms must be a whole number from 0 to 10';
  if (room.size !== null && !isBetween(room.size, 1, 500)) fields.size = 'Size must be from 1 to 500 m² (or leave it empty)';
  if (!isBetween(room.price, 0, 999999.99)) fields.price = 'Monthly rent must be from 0 to 999,999.99';
  if (room.minimumLease !== null && !isIntBetween(room.minimumLease, 1, 36)) {
    fields.minimumLease = 'Minimum lease must be a whole number from 1 to 36 months (or leave it empty)';
  }
  if (!room.owner.name) fields['owner.name'] = 'Owner name is required';
  if (!PHONE_PATTERN.test(room.owner.phone)) fields['owner.phone'] = 'Phone must look like 080-123-1234';
  if (room.owner.email && !EMAIL_PATTERN.test(room.owner.email)) fields['owner.email'] = 'Enter a valid email address';
  validateAppliances(room.appliances, fields);
  return fields;
}

async function saveRoom(event) {
  event.preventDefault();
  if (saveButton.disabled) return;
  const body = readRoomForm();
  const fields = validateRoom(body);
  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please fix the highlighted fields.', fields });
    return;
  }

  clearFieldErrors(form);
  setBusy(saveButton, true);
  const isEdit = Boolean(editingRoom);
  const sentBoxes = tickedBoxes();
  try {
    const saved = isEdit ? await updateRoom(body.roomId, body) : await createRoom(body);
    showToast(`Room ${saved.roomId} ${isEdit ? 'updated' : 'created'}`, 'success');
    resetEditor();
    loadRooms();
  } catch (error) {
    showApiError(form, mapApplianceErrors(error, sentBoxes));
  } finally {
    setBusy(saveButton, false);
  }
}

// ================= Init =================

function openAddForm() {
  resetEditor();
  $('room-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.roomId.focus({ preventScroll: true });
}

function bindEditor() {
  form.addEventListener('submit', saveRoom);
  $('room-cancel').addEventListener('click', resetEditor);
  $('tab-add').addEventListener('click', resetEditor);
  $('new-room').addEventListener('click', openAddForm);
}

renderAdminHeader('rooms', null);
renderFooter('admin');
const admin = await requireAdmin($('page-state'));
if (admin) {
  renderAdminHeader('rooms', admin);
  renderApplianceOptions();
  bindSearchCard();
  bindEditor();
  resetEditor();
  $('page-content').classList.remove('hidden');
  loadRooms();
}
