// admin-rooms.js — สคริปต์หน้าจัดการห้อง (admin/rooms.html)
// ส่วนที่ 1: ตารางห้อง (ค้นหา + แบ่งหน้า + ปุ่มแก้ไข/ลบ)
// ส่วนที่ 2: เครื่องใช้ไฟฟ้า (เช็กบ็อกซ์ + เลขซีเรียล)
// ส่วนที่ 3: ฟอร์มเพิ่ม/แก้ไขห้อง
// ส่วนที่ 4: รูปห้อง (อัปโหลด / ลบ)

const PAGE_SIZE = 6;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ROOM_ID_PATTERN = /^L-\d{4}$/;
const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// รูปแบบ key error ของเครื่องใช้ไฟฟ้าจาก API เช่น "appliances.0.serialNumber"
const APPLIANCE_ERROR_KEY = /^appliances\.(\d+)\.(serialNumber|name)$/;

const roomForm = document.getElementById('room-form');
const saveButton = document.getElementById('room-save');

const roomSearch = { q: '', type: '', available: '', page: 1 }; // ตัวกรองของตารางตอนนี้
let editingRoom = null;   // ห้องที่กำลังแก้ไข (null = โหมดเพิ่มห้องใหม่)
let pendingFiles = [];    // รูปที่เลือกแล้วแต่ยังไม่อัปโหลด: { file, previewUrl }
let latestListRequest = 0;

// ================= ส่วนที่ 1: ตารางห้อง =================

// ป้ายสถานะในตาราง: Available (พื้นเทา) / Occupied (พื้นใส)
function statusPill(available) {
  if (available) {
    return '<span class="status-pill status-pill--available">Available</span>';
  }
  return '<span class="status-pill">Occupied</span>';
}

// แถวในตาราง 1 แถว
function roomRow(room) {
  const id = escapeHtml(room.roomId);
  return `
    <tr>
      <td><div class="thumb">${imageHtml(firstImageUrl(room), 'Room ' + room.roomId)}</div></td>
      <td class="room-id">${id}</td>
      <td><span class="pill">${escapeHtml(room.roomType)}</span></td>
      <td>${escapeHtml(formatPrice(room.price))}</td>
      <td>${statusPill(room.available)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn" data-action="edit" data-room-id="${id}" title="Edit" aria-label="Edit room ${id}"><img src="../img/icon-edit.svg" alt=""></button>
          <button type="button" class="icon-btn" data-action="delete" data-room-id="${id}" title="Delete" aria-label="Delete room ${id}"><img src="../img/icon-trash.svg" alt=""></button>
        </div>
      </td>
    </tr>`;
}

// วาดตาราง + ข้อความ "Showing 1-6 of N rooms" + ปุ่มแบ่งหน้า แล้วผูกปุ่มแก้ไข/ลบ
function renderRooms(rooms, meta) {
  const tbody = document.getElementById('rooms-body');
  let html = '';
  for (const room of rooms) {
    html += roomRow(room);
  }
  tbody.innerHTML = html;

  for (const button of tbody.querySelectorAll('button[data-action="edit"]')) {
    button.addEventListener('click', function () {
      startEdit(button.dataset.roomId, button);
    });
  }
  for (const button of tbody.querySelectorAll('button[data-action="delete"]')) {
    button.addEventListener('click', function () {
      removeRoom(button.dataset.roomId, button);
    });
  }

  document.getElementById('rooms-range').textContent = rangeText(meta, rooms.length, 'rooms');
  renderPagination(document.getElementById('rooms-pagination'), meta, function (page) {
    roomSearch.page = page;
    loadRooms();
  });
  if (rooms.length > 0) {
    document.getElementById('rooms-state').innerHTML = '';
  } else {
    showState(document.getElementById('rooms-state'), 'empty', 'No rooms match this search.');
  }
}

// โหลดห้องตามตัวกรองใน roomSearch
async function loadRooms() {
  latestListRequest = latestListRequest + 1;
  const requestId = latestListRequest;
  const stateBox = document.getElementById('rooms-state');
  document.getElementById('rooms-body').innerHTML = '';
  document.getElementById('rooms-range').textContent = '';
  showState(stateBox, 'loading', 'Loading rooms...');
  try {
    const answer = await listRooms({
      q: roomSearch.q, type: roomSearch.type, available: roomSearch.available,
      page: roomSearch.page, pageSize: PAGE_SIZE,
    });
    if (requestId !== latestListRequest) {
      return;
    }
    // ถ้าเพิ่งลบแถวสุดท้ายของหน้าสุดท้าย ให้ถอยไปหน้าก่อนหน้า
    if (answer.data.length === 0 && answer.meta && roomSearch.page > 1) {
      const lastPage = Math.max(1, Math.ceil(answer.meta.total / answer.meta.pageSize));
      if (roomSearch.page > lastPage) {
        roomSearch.page = lastPage;
        loadRooms();
        return;
      }
    }
    renderRooms(answer.data, answer.meta);
  } catch (error) {
    if (requestId === latestListRequest) {
      showState(stateBox, 'error', error.message, 'Could not load rooms');
    }
  }
}

// กดปุ่มลบ: ถามยืนยันก่อน แล้วลบห้อง
async function removeRoom(roomId, button) {
  const sure = window.confirm('Delete room ' + roomId + '? Its appliances and images will be deleted too. This cannot be undone.');
  if (!sure) {
    return;
  }
  button.disabled = true;
  try {
    await deleteRoom(roomId);
    showToast('Room ' + roomId + ' deleted', 'success');
    if (editingRoom && editingRoom.roomId === roomId) {
      resetEditor();
    }
    loadRooms();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

// กดปุ่มแก้ไข: โหลดห้องล่าสุดจาก API แล้วใส่ลงฟอร์ม
async function startEdit(roomId, button) {
  button.disabled = true;
  try {
    const room = await getRoom(roomId);
    fillEditor(room);
    document.getElementById('room-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showToast(error.message, 'error');
  }
  button.disabled = false;
}

// กล่องค้นหาด้านซ้าย: กด Search
function handleSearchSubmit(event) {
  event.preventDefault();
  const searchForm = document.getElementById('room-search');
  roomSearch.q = searchForm.elements.q.value.trim();
  roomSearch.type = searchForm.elements.type.value;
  roomSearch.available = searchForm.elements.available.value;
  roomSearch.page = 1;
  loadRooms();
}

// ================= ส่วนที่ 2: เครื่องใช้ไฟฟ้า =================

// สร้างเช็กบ็อกซ์ 10 อัน แต่ละอันมีช่องเลขซีเรียล (ชื่อช่อง serial-0, serial-1, ...) ที่โผล่เมื่อติ๊ก
function renderApplianceOptions() {
  let html = '';
  for (let i = 0; i < APPLIANCES.length; i = i + 1) {
    const name = escapeHtml(APPLIANCES[i]);
    html += `
      <div class="field appliance-option">
        <label for="appliance-${i}">
          <input type="checkbox" id="appliance-${i}" name="appliance" value="${name}" data-index="${i}">
          ${name}
        </label>
        <input type="text" name="serial-${i}" maxlength="50" placeholder="Serial number"
               autocomplete="off" aria-label="${name} serial number">
      </div>`;
  }
  const container = document.getElementById('appliance-options');
  container.innerHTML = html;
  for (const box of getApplianceBoxes()) {
    box.addEventListener('change', syncSerialInputs);
  }
}

// เช็กบ็อกซ์เครื่องใช้ไฟฟ้าทั้งหมด
function getApplianceBoxes() {
  return roomForm.querySelectorAll('input[name="appliance"]');
}

// เฉพาะอันที่ติ๊กไว้ (เรียงตามลำดับที่ส่งไป API -> error ลำดับที่ N = อันที่ N ในนี้)
function getTickedBoxes() {
  const ticked = [];
  for (const box of getApplianceBoxes()) {
    if (box.checked) {
      ticked.push(box);
    }
  }
  return ticked;
}

// ช่องเลขซีเรียลที่คู่กับเช็กบ็อกซ์
function serialInputFor(box) {
  return roomForm.elements['serial-' + box.dataset.index];
}

// ช่องเลขซีเรียลโผล่และพิมพ์ได้เฉพาะตอนติ๊กเครื่องใช้ไฟฟ้านั้น
function syncSerialInputs() {
  for (const box of getApplianceBoxes()) {
    const serialInput = serialInputFor(box);
    serialInput.disabled = !box.checked;
    if (box.checked) {
      serialInput.classList.remove('hidden');
    } else {
      serialInput.classList.add('hidden');
    }
  }
}

// ติ๊กเช็กบ็อกซ์และใส่เลขซีเรียลตามข้อมูลห้อง
function fillAppliances(appliances) {
  for (const box of getApplianceBoxes()) {
    let serial = '';
    let found = false;
    for (const appliance of appliances || []) {
      if (appliance.name === box.value) {
        serial = appliance.serialNumber;
        found = true;
      }
    }
    box.checked = found;
    serialInputFor(box).value = serial;
  }
  syncSerialInputs();
}

// อ่านเครื่องใช้ไฟฟ้าที่ติ๊กไว้ -> [{ serialNumber, name }]
function readAppliances() {
  const appliances = [];
  for (const box of getTickedBoxes()) {
    appliances.push({ serialNumber: serialInputFor(box).value.trim(), name: box.value });
  }
  return appliances;
}

// ตรวจเลขซีเรียล: ต้องกรอก และห้ามซ้ำกันในห้องเดียวกัน
function validateAppliances(fields) {
  const used = [];
  for (const box of getTickedBoxes()) {
    const serial = serialInputFor(box).value.trim();
    const key = 'serial-' + box.dataset.index;
    if (serial === '') {
      fields[key] = 'Serial number is required for ' + box.value;
    } else if (used.includes(serial)) {
      fields[key] = 'This serial number is already used in this room';
    }
    used.push(serial);
  }
}

// เปลี่ยน key error "appliances.N.serialNumber" จาก API ให้ชี้ไปที่ช่องซีเรียลของอันที่ N ที่ส่งไป
function mapApplianceErrors(error, sentBoxes) {
  const fields = {};
  for (const key of Object.keys(error.fields)) {
    const match = APPLIANCE_ERROR_KEY.exec(key);
    if (match && sentBoxes[Number(match[1])]) {
      fields['serial-' + sentBoxes[Number(match[1])].dataset.index] = error.fields[key];
    } else {
      fields[key] = error.fields[key];
    }
  }
  return { message: error.message, fields: fields };
}

// ================= ส่วนที่ 3: ฟอร์มเพิ่ม/แก้ไขห้อง =================

// สลับแท็บ Add / Edit (room = null คือโหมดเพิ่ม)
function setMode(room) {
  editingRoom = room;
  const tabAdd = document.getElementById('tab-add');
  const tabEdit = document.getElementById('tab-edit');
  tabAdd.setAttribute('aria-selected', room ? 'false' : 'true');
  tabEdit.setAttribute('aria-selected', room ? 'true' : 'false');
  tabEdit.disabled = !room;
  tabEdit.textContent = room ? 'Edit Room ' + room.roomId : 'Edit Room';
  roomForm.elements.roomId.readOnly = Boolean(room); // แก้รหัสห้องไม่ได้
  showSaveLabel();
}

// ข้อความปุ่มบันทึก: โหมดเพิ่ม = "Create Room", โหมดแก้ไข = "Save Room" (ตาม Figma)
function showSaveLabel() {
  if (!saveButton.disabled) {
    saveButton.textContent = editingRoom ? 'Save Room' : 'Create Room';
  }
}

// ล้างฟอร์มกลับเป็นโหมดเพิ่มห้องใหม่
function resetEditor() {
  roomForm.reset();
  clearPendingFiles();
  syncSerialInputs();
  clearFieldErrors(roomForm);
  setMode(null);
  renderImageList();
}

// ใส่ข้อมูลห้องลงฟอร์ม (โหมดแก้ไข)
function fillEditor(room) {
  resetEditor();
  const names = ['roomId', 'building', 'floor', 'roomType', 'size', 'price', 'bedrooms', 'minimumLease', 'conditionRating'];
  for (const name of names) {
    let value = room[name];
    if (value === null || value === undefined) {
      value = '';
    }
    roomForm.elements[name].value = value;
  }
  roomForm.elements.available.value = room.available ? 'true' : 'false';
  roomForm.elements.description.value = room.description || '';
  const owner = room.owner || {};
  roomForm.elements['owner.name'].value = owner.name || '';
  roomForm.elements['owner.phone'].value = owner.phone || '';
  roomForm.elements['owner.email'].value = owner.email || '';
  roomForm.elements['owner.lineId'].value = owner.lineId || '';
  fillAppliances(room.appliances);
  setMode(room);
  renderImageList();
}

// ค่าตัวเลขจากช่อง (ว่าง -> null)
function numberOrNull(name) {
  const text = roomForm.elements[name].value.trim();
  if (text === '') {
    return null;
  }
  return Number(text);
}

// ค่าข้อความจากช่อง (ว่าง -> null)
function textOrNull(name) {
  const text = roomForm.elements[name].value.trim();
  if (text === '') {
    return null;
  }
  return text;
}

// อ่านฟอร์มเป็น object Room ตาม API.md (ไม่มี images เพราะรูปส่งแยก)
function readRoomForm() {
  let roomId = roomForm.elements.roomId.value.trim();
  if (editingRoom) {
    roomId = editingRoom.roomId;
  }
  return {
    roomId: roomId,
    building: roomForm.elements.building.value.trim(),
    floor: numberOrNull('floor'),
    roomType: roomForm.elements.roomType.value,
    bedrooms: numberOrNull('bedrooms'),
    size: numberOrNull('size'),
    price: numberOrNull('price'),
    description: textOrNull('description'),
    conditionRating: numberOrNull('conditionRating'),
    minimumLease: numberOrNull('minimumLease'),
    available: roomForm.elements.available.value === 'true',
    appliances: readAppliances(),
    owner: {
      name: roomForm.elements['owner.name'].value.trim(),
      phone: roomForm.elements['owner.phone'].value.trim(),
      email: textOrNull('owner.email'),
      lineId: textOrNull('owner.lineId'),
    },
  };
}

// เป็นจำนวนเต็มในช่วง min..max ไหม
function isIntBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// เป็นตัวเลขในช่วง min..max ไหม
function isNumberBetween(value, min, max) {
  return value !== null && value >= min && value <= max;
}

// ตรวจฟอร์มด้วยกฎเดียวกับตาราง Room ใน API.md คืน object ข้อความผิด
function validateRoom(room) {
  const fields = {};
  if (!ROOM_ID_PATTERN.test(room.roomId)) fields.roomId = 'Room ID must look like L-1203 (L- and 4 digits)';
  if (room.building === '') fields.building = 'Building is required';
  if (!isIntBetween(room.floor, 1, 99)) fields.floor = 'Floor must be a whole number from 1 to 99';
  if (!ROOM_TYPES.includes(room.roomType)) fields.roomType = 'Choose a room type';
  if (!isIntBetween(room.bedrooms, 0, 10)) fields.bedrooms = 'Bedrooms must be a whole number from 0 to 10';
  if (room.size !== null && !isNumberBetween(room.size, 1, 500)) fields.size = 'Size must be from 1 to 500 m² (or leave it empty)';
  if (!isNumberBetween(room.price, 0, 999999.99)) fields.price = 'Monthly rent must be from 0 to 999,999.99';
  if (!isIntBetween(room.conditionRating, 1, 5)) fields.conditionRating = 'Condition rating must be 1 to 5';
  if (room.minimumLease !== null && !isIntBetween(room.minimumLease, 1, 36)) {
    fields.minimumLease = 'Minimum lease must be a whole number from 1 to 36 months (or leave it empty)';
  }
  if (room.owner.name === '') fields['owner.name'] = 'Owner name is required';
  if (!PHONE_PATTERN.test(room.owner.phone)) fields['owner.phone'] = 'Phone must look like 080-123-1234';
  if (room.owner.email && !EMAIL_PATTERN.test(room.owner.email)) fields['owner.email'] = 'Enter a valid email address';
  validateAppliances(fields);
  return fields;
}

// กด Save Room: ตรวจฟอร์ม -> บันทึกห้อง -> อัปโหลดรูปใหม่ (ถ้ามี)
async function saveRoom(event) {
  event.preventDefault();
  if (saveButton.disabled) {
    return;
  }
  const body = readRoomForm();
  const fields = validateRoom(body);
  if (Object.keys(fields).length > 0) {
    showApiError(roomForm, { message: 'Please fix the highlighted fields.', fields: fields });
    return;
  }

  clearFieldErrors(roomForm);
  setBusy(saveButton, true);
  const isEdit = Boolean(editingRoom);
  const sentBoxes = getTickedBoxes();
  let saved;
  try {
    if (isEdit) {
      saved = await updateRoom(body.roomId, body);
    } else {
      saved = await createRoom(body);
    }
  } catch (error) {
    showApiError(roomForm, mapApplianceErrors(error, sentBoxes));
    setBusy(saveButton, false);
    return;
  }
  await finishSave(saved, isEdit);
  setBusy(saveButton, false);
  showSaveLabel(); // ฟอร์มอาจเปลี่ยนโหมดระหว่างบันทึก
}

// หลังบันทึกห้องสำเร็จ: อัปโหลดรูปที่เลือกไว้ แล้วล้างฟอร์ม
// ถ้ารูปอัปโหลดไม่ผ่าน ห้องถูกบันทึกแล้ว -> อยู่ในโหมดแก้ไขห้องนั้นต่อ เพื่อให้ลองอัปโหลดใหม่ได้
async function finishSave(saved, isEdit) {
  if (pendingFiles.length > 0) {
    const files = [];
    for (const pending of pendingFiles) {
      files.push(pending.file);
    }
    try {
      await uploadRoomImages(saved.roomId, files);
    } catch (error) {
      setMode(saved);
      renderImageList();
      showFormError(roomForm, 'Room ' + saved.roomId + ' was saved, but the images were not uploaded: ' + error.message);
      loadRooms();
      return;
    }
  }
  showToast('Room ' + saved.roomId + (isEdit ? ' updated' : ' created'), 'success');
  resetEditor();
  loadRooms();
}

// ================= ส่วนที่ 4: รูปห้อง =================

// กล่องรูป 1 รูป พร้อมป้าย (Saved/New) และปุ่ม × ลบ
function imageItemHtml(url, tag, kind, value) {
  return `
    <div class="image-item">
      ${imageHtml(url, tag + ' room image')}
      <span class="image-item__tag">${escapeHtml(tag)}</span>
      <button type="button" class="image-item__remove" data-kind="${escapeHtml(kind)}" data-value="${escapeHtml(value)}"
              aria-label="Remove image">×</button>
    </div>`;
}

// วาดรายการรูป: รูปที่บันทึกแล้วของห้อง (โหมดแก้ไข) + รูปที่เพิ่งเลือก
function renderImageList() {
  let html = '';
  if (editingRoom && editingRoom.images) {
    for (const image of editingRoom.images) {
      html += imageItemHtml(image.url, 'Saved', 'saved', image.imageId);
    }
  }
  for (let i = 0; i < pendingFiles.length; i = i + 1) {
    html += imageItemHtml(pendingFiles[i].previewUrl, 'New', 'pending', i);
  }
  if (html === '') {
    html = '<p class="muted">No images yet.</p>';
  }
  const list = document.getElementById('image-list');
  list.innerHTML = html;

  for (const button of list.querySelectorAll('.image-item__remove')) {
    button.addEventListener('click', function () {
      if (button.dataset.kind === 'saved') {
        removeSavedImage(button.dataset.value, button);
      } else {
        removePendingFile(Number(button.dataset.value));
      }
    });
  }
}

// ลบรูปที่บันทึกแล้ว (เรียก API ทันที)
async function removeSavedImage(imageId, button) {
  if (!window.confirm('Remove this image from the room?')) {
    return;
  }
  button.disabled = true;
  try {
    editingRoom = await deleteRoomImage(editingRoom.roomId, imageId);
    renderImageList();
    loadRooms();
  } catch (error) {
    button.disabled = false;
    showToast(error.message, 'error');
  }
}

// เอารูปที่เพิ่งเลือกออก (ยังไม่ได้อัปโหลด จึงไม่ต้องเรียก API)
function removePendingFile(index) {
  URL.revokeObjectURL(pendingFiles[index].previewUrl);
  pendingFiles.splice(index, 1);
  renderImageList();
}

// ล้างรูปที่เลือกไว้ทั้งหมด
function clearPendingFiles() {
  for (const pending of pendingFiles) {
    URL.revokeObjectURL(pending.previewUrl);
  }
  pendingFiles = [];
}

// ตรวจไฟล์รูป 1 ไฟล์ คืนข้อความปัญหา หรือ '' ถ้าใช้ได้
function imageProblem(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return file.name + ': only JPG, PNG or WEBP images are allowed';
  }
  if (file.size > MAX_FILE_BYTES) {
    return file.name + ': larger than 2 MB';
  }
  return '';
}

// เลือกไฟล์จากช่อง Room Images: เก็บไว้ใน pendingFiles รออัปโหลดตอนกด Save
function handleFilesChosen(event) {
  const input = event.target;
  const problems = [];
  for (const file of input.files) {
    const problem = imageProblem(file);
    if (problem !== '') {
      problems.push(problem);
    } else if (pendingFiles.length >= MAX_FILES) {
      problems.push(file.name + ': max ' + MAX_FILES + ' images per save');
    } else {
      pendingFiles.push({ file: file, previewUrl: URL.createObjectURL(file) });
    }
  }
  input.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้
  if (problems.length > 0) {
    showFormError(roomForm, problems.join(' · '));
  }
  renderImageList();
}

// ================= เริ่มหน้า =================

// ผูกปุ่มและฟอร์มทั้งหมดของหน้า
function bindRoomPage() {
  const searchForm = document.getElementById('room-search');
  searchForm.addEventListener('submit', handleSearchSubmit);
  roomForm.addEventListener('submit', saveRoom);
  document.getElementById('r-images').addEventListener('change', handleFilesChosen);
  document.getElementById('room-cancel').addEventListener('click', resetEditor);
  document.getElementById('tab-add').addEventListener('click', resetEditor);
}

// ตรวจการล็อกอินก่อน แล้วค่อยแสดงหน้า
async function startAdminRoomsPage() {
  const admin = await requireAdmin(document.getElementById('page-state'));
  if (!admin) {
    return;
  }
  setupAdminHeader(admin);
  renderApplianceOptions();
  bindRoomPage();
  resetEditor();
  document.getElementById('page-content').classList.remove('hidden');
  loadRooms();
}

startAdminRoomsPage();
