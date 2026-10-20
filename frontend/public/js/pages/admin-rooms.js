// Admin "Product management": room table (search + pagination) and the Add/Edit room form.
import {
  createRoom, deleteRoom, deleteRoomImage, getRoom, listRooms, updateRoom, uploadRoomImages,
} from '../api.js';
import { requireAdmin } from '../auth-guard.js';
import {
  APPLIANCES, ROOM_TYPES, availabilityBadge, clearFieldErrors, formatPrice, h, imageOrPlaceholder,
  rangeText, renderAdminHeader, renderFooter, renderPagination, renderState, setBusy, showApiError,
  showFormError, showToast, toImage,
} from '../ui.js';

const PAGE_SIZE = 6;
const MAX_FILES_PER_UPLOAD = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const $ = (id) => document.getElementById(id);
const form = $('room-form');
const saveButton = $('room-save');

const listState = { q: '', type: '', available: '', page: 1 };
// `room` is the room being edited (null = add mode); `pendingFiles` are chosen but not uploaded yet.
const editor = { room: null, pendingFiles: [] };
let latestListRequest = 0;

// ================= Room table =================

function roomRow(room) {
  const cover = room.images && room.images.length ? toImage(room.images[0]).src : null;
  const editButton = h('button', { type: 'button', className: 'icon-btn', text: '✎', title: 'Edit', 'aria-label': `Edit room ${room.roomId}` });
  const deleteButton = h('button', { type: 'button', className: 'icon-btn icon-btn--danger', text: '🗑', title: 'Delete', 'aria-label': `Delete room ${room.roomId}` });
  editButton.addEventListener('click', () => startEdit(room.roomId, editButton));
  deleteButton.addEventListener('click', () => removeRoom(room, deleteButton));

  return h('tr', {}, [
    h('td', {}, [h('div', { className: 'thumb' }, [imageOrPlaceholder(cover, `Room ${room.roomId}`)])]),
    h('td', {}, [h('strong', { text: String(room.roomId) })]),
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
  if (!window.confirm(`Delete room ${room.roomId}? Its images will be deleted too. This cannot be undone.`)) return;
  button.disabled = true;
  try {
    await deleteRoom(room.roomId);
    showToast(`Room ${room.roomId} deleted`, 'success');
    if (editor.room && editor.room.roomId === room.roomId) resetEditor();
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

// ================= Add / Edit form =================

function setMode(room) {
  editor.room = room;
  const tabAdd = $('tab-add');
  const tabEdit = $('tab-edit');
  tabAdd.setAttribute('aria-selected', String(!room));
  tabEdit.setAttribute('aria-selected', String(Boolean(room)));
  tabEdit.disabled = !room;
  tabEdit.textContent = room ? `Edit Room ${room.roomId}` : 'Edit Room';
  form.elements.roomId.readOnly = Boolean(room);
}

function clearPendingFiles() {
  editor.pendingFiles.forEach((pending) => URL.revokeObjectURL(pending.url));
  editor.pendingFiles = [];
}

function resetEditor() {
  form.reset();
  clearPendingFiles();
  clearFieldErrors(form);
  setMode(null);
  renderImages();
}

function fillEditor(room) {
  resetEditor();
  const fields = form.elements;
  for (const name of ['roomId', 'floor', 'roomType', 'size', 'price', 'bedrooms', 'minimumLease', 'conditionRating']) {
    fields[name].value = room[name] ?? '';
  }
  fields.available.value = String(Boolean(room.available));
  fields.description.value = room.description || '';
  const owner = room.owner || {};
  for (const key of ['name', 'phone', 'email', 'lineId']) fields[`owner.${key}`].value = owner[key] || '';
  form.querySelectorAll('input[name="appliances"]').forEach((box) => {
    box.checked = (room.appliances || []).includes(box.value);
  });
  setMode(room);
  renderImages();
}

function readRoomForm() {
  const fields = form.elements;
  const number = (name) => (fields[name].value.trim() === '' ? null : Number(fields[name].value));
  const optional = (name) => fields[name].value.trim() || null;
  return {
    roomId: editor.room ? editor.room.roomId : number('roomId'),
    building: editor.room ? editor.room.building : undefined,
    floor: number('floor'),
    roomType: fields.roomType.value,
    bedrooms: number('bedrooms'),
    size: number('size'),
    price: number('price'),
    description: optional('description'),
    conditionRating: number('conditionRating'),
    minimumLease: number('minimumLease'),
    available: fields.available.value === 'true',
    appliances: [...form.querySelectorAll('input[name="appliances"]:checked')].map((box) => box.value),
    owner: {
      name: fields['owner.name'].value.trim(),
      phone: optional('owner.phone'),
      email: optional('owner.email'),
      lineId: optional('owner.lineId'),
    },
  };
}

const isIntBetween = (value, min, max = Infinity) => Number.isInteger(value) && value >= min && value <= max;

/** Same rules as API.md "Validation for room body". */
function validateRoom(room) {
  const fields = {};
  if (!isIntBetween(room.roomId, 1, 99999)) fields.roomId = 'Room ID must be a whole number from 1 to 99999';
  if (!isIntBetween(room.floor, 1, 99)) fields.floor = 'Floor must be a whole number from 1 to 99';
  if (!ROOM_TYPES.includes(room.roomType)) fields.roomType = 'Choose a room type';
  if (!isIntBetween(room.bedrooms, 0, 10)) fields.bedrooms = 'Bedrooms must be a whole number from 0 to 10';
  if (!(room.size > 0)) fields.size = 'Size must be greater than 0';
  if (room.price === null || !(room.price >= 0)) fields.price = 'Monthly rent must be 0 or more';
  if (!isIntBetween(room.conditionRating, 1, 5)) fields.conditionRating = 'Rating must be 1 to 5';
  if (!isIntBetween(room.minimumLease, 1)) fields.minimumLease = 'Minimum lease must be at least 1 month';
  if (!room.owner.name) fields['owner.name'] = 'Owner name is required';
  if (room.owner.email && !EMAIL_PATTERN.test(room.owner.email)) fields['owner.email'] = 'Enter a valid email address';
  return fields;
}

async function uploadPendingImages(room) {
  if (!editor.pendingFiles.length) return room;
  const updated = await uploadRoomImages(room.roomId, editor.pendingFiles.map((pending) => pending.file));
  clearPendingFiles();
  return updated;
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
  const isEdit = Boolean(editor.room);
  let saved;
  try {
    saved = isEdit ? await updateRoom(body.roomId, body) : await createRoom(body);
  } catch (error) {
    setBusy(saveButton, false);
    showApiError(form, error);
    return;
  }

  try {
    await uploadPendingImages(saved);
    showToast(`Room ${saved.roomId} ${isEdit ? 'updated' : 'created'}`, 'success');
    resetEditor();
  } catch (error) {
    // The room itself is saved; stay on it in edit mode so the images can be retried.
    setMode(saved);
    renderImages();
    showFormError(form, `Room ${saved.roomId} was saved, but the images were not uploaded: ${error.message}`);
  } finally {
    setBusy(saveButton, false);
    loadRooms();
  }
}

// ================= Images =================

function imageItem(src, tag, onRemove) {
  const remove = h('button', { type: 'button', className: 'image-item__remove', text: '×', 'aria-label': 'Remove image' });
  remove.addEventListener('click', () => onRemove(remove));
  return h('div', { className: 'image-item' }, [
    imageOrPlaceholder(src, `${tag} room image`),
    h('span', { className: 'image-item__tag', text: tag }),
    remove,
  ]);
}

function renderImages() {
  const saved = ((editor.room && editor.room.images) || []).map(toImage).filter((image) => image.src);
  const items = [
    ...saved.map((image) => imageItem(image.src, 'Saved', (button) => removeSavedImage(image.id, button))),
    ...editor.pendingFiles.map((pending) => imageItem(pending.url, 'New', () => removePendingFile(pending))),
  ];
  if (!items.length) items.push(h('p', { className: 'muted', text: 'No images yet.' }));
  $('image-list').replaceChildren(...items);
}

async function removeSavedImage(imageId, button) {
  if (!window.confirm('Remove this image from the room?')) return;
  button.disabled = true;
  try {
    editor.room = await deleteRoomImage(editor.room.roomId, imageId);
    renderImages();
    loadRooms();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

function removePendingFile(pending) {
  URL.revokeObjectURL(pending.url);
  editor.pendingFiles = editor.pendingFiles.filter((item) => item !== pending);
  renderImages();
}

function imageProblem(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WEBP images are allowed`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: larger than 2 MB`;
  return null;
}

function addPendingFiles(event) {
  const input = event.target;
  const problems = [];
  for (const file of input.files) {
    const problem = imageProblem(file);
    if (problem) problems.push(problem);
    else if (editor.pendingFiles.length >= MAX_FILES_PER_UPLOAD) problems.push(`${file.name}: max ${MAX_FILES_PER_UPLOAD} images per save`);
    else editor.pendingFiles.push({ file, url: URL.createObjectURL(file) });
  }
  input.value = '';
  if (problems.length) showToast(problems.join(' · '), 'error');
  renderImages();
}

// ================= Init =================

function renderApplianceOptions() {
  $('appliance-options').replaceChildren(...APPLIANCES.map((name, index) => {
    const id = `appliance-${index}`;
    return h('label', { for: id }, [h('input', { type: 'checkbox', id, name: 'appliances', value: name }), name]);
  }));
}

function openAddForm() {
  resetEditor();
  $('room-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.roomId.focus({ preventScroll: true });
}

function bindEditor() {
  form.addEventListener('submit', saveRoom);
  $('r-images').addEventListener('change', addPendingFiles);
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
