// room.js — สคริปต์หน้ารายละเอียดห้อง (room.html?id=L-1201)
// โหลดห้องจาก API แล้วเติมรูป ข้อมูลห้อง สภาพห้อง เจ้าของ เครื่องใช้ไฟฟ้า ค่าเช่า และห้องที่คล้ายกัน

// ไอคอนของเครื่องใช้ไฟฟ้าแต่ละชนิด
const APPLIANCE_ICONS = {
  'Sofa': '🛋️',
  'Water heater': '🚿',
  'Fridge': '🧊',
  'TV': '📺',
  'HomePhone': '☎️',
  'Air conditioner': '❄️',
  'Heater': '🔥',
  'Washing machine': '🧺',
  'Microwave': '🍲',
  'Induction stove': '🍳',
};
const GALLERY_SLOTS = 4; // รูปใหญ่ 1 + รูปเล็ก 3
const ROOM_ID_PATTERN = /^L-\d{4}$/;

const roomState = document.getElementById('room-state');

// แสดง "ไม่พบห้อง" พร้อมปุ่มกลับไปหน้าค้นหา
function showNotFound() {
  document.title = 'Room not found · AURA Sukhumvit 36';
  roomState.innerHTML = `
    <div class="state state--empty" role="status">
      <p class="state__title">Room not found</p>
      <p>This room does not exist or has been removed.</p>
      <a class="btn btn--primary" href="/search.html">Browse available rooms</a>
    </div>`;
}

// รูป 4 ช่อง: ใช้รูปจาก API ก่อน ช่องที่ไม่มีรูปเป็นกล่องเทา
function renderGallery(room) {
  let html = '';
  for (let i = 0; i < GALLERY_SLOTS; i = i + 1) {
    let url = '';
    if (room.images && room.images[i]) {
      url = room.images[i].url;
    }
    html += `<div>${imageHtml(url, 'Room ' + room.roomId + ' photo ' + (i + 1))}</div>`;
  }
  document.getElementById('gallery').innerHTML = html;
}

// ชื่อห้อง ตึก แถวข้อมูล (ห้องนอน · ขนาด · ชั้น · ประเภท) สภาพห้อง และคำอธิบาย
function renderSummary(room) {
  document.getElementById('room-title').textContent = 'Room ' + room.roomId;
  document.getElementById('room-building').textContent = room.building;
  document.getElementById('room-facts').innerHTML = `
    <li>${escapeHtml(bedroomText(room.bedrooms))}</li>
    <li>${escapeHtml(sizeText(room.size))}</li>
    <li>Floor ${escapeHtml(room.floor)}</li>
    <li>${escapeHtml(room.roomType)}</li>`;
  document.getElementById('room-condition').textContent = conditionText(room.conditionRating);
  document.getElementById('room-description').textContent = room.description || 'No description yet.';
}

// การ์ดเจ้าของห้อง (ชื่อ เบอร์ อีเมล LINE ID)
function renderOwner(owner) {
  if (!owner) {
    owner = {};
  }
  const rows = [
    { label: 'Name', value: owner.name },
    { label: 'Phone', value: owner.phone },
    { label: 'Email', value: owner.email },
    { label: 'LINE ID', value: owner.lineId },
  ];
  let html = '';
  for (const row of rows) {
    html += `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value || '-')}</dd></div>`;
  }
  document.getElementById('owner-card').innerHTML = html;
}

// รายการเครื่องใช้ไฟฟ้า (ผู้เช่าเห็นแค่ชื่อ ไม่ต้องเห็นเลขซีเรียล)
function renderAppliances(appliances) {
  const list = document.getElementById('appliances');
  if (!appliances || appliances.length === 0) {
    list.innerHTML = '<li class="muted">No appliances listed.</li>';
    return;
  }
  let html = '';
  for (const appliance of appliances) {
    const icon = APPLIANCE_ICONS[appliance.name] || '•';
    html += `
      <li>
        <span class="appliances__icon" aria-hidden="true">${escapeHtml(icon)}</span>
        <span>${escapeHtml(appliance.name)}</span>
      </li>`;
  }
  list.innerHTML = html;
}

// กล่องค่าเช่าด้านขวา: ราคา สถานะ และสัญญาขั้นต่ำ
function renderRentBox(room) {
  document.getElementById('room-price').textContent = formatPrice(room.price);
  document.getElementById('room-status').innerHTML = statusBadge(room.available, 'Available now');
  const lease = room.minimumLease;
  let leaseText = 'Minimum lease –';
  if (lease === 1) {
    leaseText = 'Minimum lease 1 month';
  } else if (lease !== null && lease !== undefined) {
    leaseText = 'Minimum lease ' + lease + ' months';
  }
  document.getElementById('room-lease').textContent = leaseText;
}

// โหลดห้องที่คล้ายกัน (ไม่เกิน 3 ห้อง) ไว้ด้านล่าง
async function loadSimilar(roomId) {
  const container = document.getElementById('similar');
  showState(container, 'loading', 'Loading similar rooms...');
  try {
    const rooms = await getSimilarRooms(roomId);
    if (rooms.length === 0) {
      showState(container, 'empty', 'No similar rooms right now.');
      return;
    }
    let html = '';
    for (const room of rooms) {
      html += roomCard(room);
    }
    container.innerHTML = html;
  } catch (error) {
    showState(container, 'error', error.message);
  }
}

// โหลดห้องตามรหัส แล้วเติมทุกส่วนของหน้า
async function loadRoom(roomId) {
  showState(roomState, 'loading', 'Loading room...');
  try {
    const room = await getRoom(roomId);
    document.title = 'Room ' + room.roomId + ' · AURA Sukhumvit 36';
    renderGallery(room);
    renderSummary(room);
    renderOwner(room.owner);
    renderAppliances(room.appliances);
    renderRentBox(room);
    roomState.innerHTML = '';
    document.getElementById('room').classList.remove('hidden');
    loadSimilar(room.roomId);
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      showNotFound();
    } else {
      showState(roomState, 'error', error.message, 'Could not load this room');
    }
  }
}

// เริ่มหน้า: อ่าน ?id= จาก URL ถ้ารูปแบบไม่ถูก (ไม่ใช่ L-1234) แสดงไม่พบห้องเลย
function startRoomPage() {
  setupPublicHeader(true);
  const roomId = (getQueryParams().id || '').trim();
  if (ROOM_ID_PATTERN.test(roomId)) {
    loadRoom(roomId);
  } else {
    showNotFound();
  }
}

startRoomPage();
