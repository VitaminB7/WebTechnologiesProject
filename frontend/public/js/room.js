// room.js — สคริปต์หน้ารายละเอียดห้อง (room.html?id=L-1201)
// โหลดห้องจาก API แล้วเติมรูป ข้อมูลห้อง สภาพห้อง เจ้าของ เครื่องใช้ไฟฟ้า ค่าเช่า และห้องที่คล้ายกัน

// ไอคอนรูปภาพจาก Figma (มี 4 ชนิด) ชนิดอื่นใช้อีโมจิใน APPLIANCE_EMOJI แทน
const APPLIANCE_IMAGES = {
  'Sofa': 'img/appliance-sofa.png',
  'Air conditioner': 'img/appliance-air.png',
  'Washing machine': 'img/appliance-washing.png',
  'Fridge': 'img/appliance-fridge.png',
};
const APPLIANCE_EMOJI = {
  'Water heater': '🚿',
  'TV': '📺',
  'HomePhone': '☎️',
  'Heater': '🔥',
  'Microwave': '🍲',
  'Induction stove': '🍳',
};
const GALLERY_SLOTS = 4; // รูปใหญ่ 1 + รูปเล็ก 3
const ROOM_ID_PATTERN = /^L-\d{4}$/;

const roomState = document.getElementById('room-state');

// แสดง "ไม่พบห้อง" พร้อมปุ่มกลับไปหน้าค้นหา
function showNotFound() {
  document.title = 'Room not found · CONDONG condo';
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

// ดาวสีเหลืองเท่ากับคะแนนสภาพห้อง เช่น 3 -> "★★★"
function starsText(rating) {
  let stars = '';
  for (let i = 0; i < Number(rating); i = i + 1) {
    stars += '★';
  }
  return stars;
}

// สภาพห้องตัวใหญ่ เช่น 3 -> "3.0 ★ สภาพดี" (จุดและดาวสีเหลือง)
function conditionHtml(rating) {
  const value = Number(rating);
  if (!CONDITION_LABELS[value]) {
    return '-';
  }
  return `
    <span class="condition__score">${value}<span class="condition__dot">.</span>0</span>
    <span class="condition__star" aria-hidden="true">★</span>
    <span class="condition__text">${escapeHtml(CONDITION_LABELS[value])}</span>`;
}

// ชื่อห้อง ดาว ตึก กล่องข้อมูล 4 ช่อง (ประเภท · ห้องนอน · ขนาด · ชั้น) สภาพห้อง และคำอธิบาย
function renderSummary(room) {
  document.getElementById('room-title').textContent = 'Room ' + room.roomId;
  document.getElementById('room-favorite').outerHTML = favoriteButtonHtml(room.roomId);
  const stars = document.getElementById('room-stars');
  stars.textContent = starsText(room.conditionRating);
  stars.setAttribute('aria-label', 'Condition ' + room.conditionRating + ' of 5');
  document.getElementById('room-building').textContent = room.building + ' · CONDONG condo';
  document.getElementById('room-facts').innerHTML = `
    <li><strong>${escapeHtml(room.roomType)}</strong><span>Room type</span></li>
    <li><strong>${escapeHtml(bedroomText(room.bedrooms))}</strong><span>Bedrooms</span></li>
    <li><strong>${escapeHtml(sizeText(room.size))}</strong><span>Usable area</span></li>
    <li><strong>Floor ${escapeHtml(room.floor)}</strong><span>${escapeHtml(room.building)}</span></li>`;
  document.getElementById('room-condition').innerHTML = conditionHtml(room.conditionRating);
  document.getElementById('room-description').textContent = room.description || 'No description yet.';
}

// การ์ดเจ้าของห้อง: ชื่อ + แถวเบอร์ อีเมล LINE ID (มีไอคอนหน้าแต่ละแถว)
function renderOwner(owner) {
  if (!owner) {
    owner = {};
  }
  document.getElementById('owner-name').textContent = owner.name || 'Room owner';
  const rows = [
    { icon: 'img/icon-phone.png', label: 'เบอร์โทร : ', value: owner.phone },
    { icon: 'img/icon-email.png', label: 'อีเมล: ', value: owner.email },
    { icon: 'img/icon-line.png', label: 'LineID: ', value: owner.lineId },
  ];
  let html = '';
  for (const row of rows) {
    html += `<li><img src="${row.icon}" alt=""><span>${escapeHtml(row.label)}${escapeHtml(row.value || '-')}</span></li>`;
  }
  document.getElementById('owner-rows').innerHTML = html;
}

// ไอคอนของเครื่องใช้ไฟฟ้า 1 ชนิด: รูปจาก Figma ถ้ามี ไม่มีใช้อีโมจิ
function applianceIconHtml(name) {
  if (APPLIANCE_IMAGES[name]) {
    return `<img src="${APPLIANCE_IMAGES[name]}" alt="">`;
  }
  return escapeHtml(APPLIANCE_EMOJI[name] || '•');
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
    html += `
      <li>
        <span class="appliances__icon" aria-hidden="true">${applianceIconHtml(appliance.name)}</span>
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
  let leaseText = '–';
  if (lease === 1) {
    leaseText = '1 month';
  } else if (lease !== null && lease !== undefined) {
    leaseText = lease + ' months';
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
    document.title = 'Room ' + room.roomId + ' · CONDONG condo';
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
  setupPublicHeader();
  const roomId = (getQueryParams().id || '').trim();
  if (ROOM_ID_PATTERN.test(roomId)) {
    loadRoom(roomId);
  } else {
    showNotFound();
  }
}

startRoomPage();
