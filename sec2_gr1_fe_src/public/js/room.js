// room.js — สคริปต์หน้ารายละเอียดห้อง (room.html?id=L-1201)
// โหลดห้องจาก API แล้วเติมรูป ข้อมูลห้อง สภาพห้อง เจ้าของ เครื่องใช้ไฟฟ้า และค่าเช่า

// ไอคอนเครื่องใช้ไฟฟ้า: SVG แบบเส้นชุดเดียวกันทั้ง 10 ชนิด (สีตามธีมผ่าน currentColor)
function svgIcon(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const APPLIANCE_ICONS = {
  'Sofa': svgIcon('<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 12a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 17v2M19 17v2"/>'),
  'Water heater': svgIcon('<rect x="6" y="2" width="12" height="15" rx="3"/><path d="M12 6v4M9 20h6M12 17v3"/>'),
  'Fridge': svgIcon('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/>'),
  'TV': svgIcon('<rect x="2" y="5" width="20" height="13" rx="2"/><path d="M8 21h8"/>'),
  'HomePhone': svgIcon('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z"/>'),
  'Air conditioner': svgIcon('<rect x="2" y="4" width="20" height="9" rx="2"/><path d="M6 10h12M8 17c0 1.5-1 2-1 3M12 16v4M16 17c0 1.5 1 2 1 3"/>'),
  'Heater': svgIcon('<path d="M12 2c1 3 4 4.5 4 8.5A4 4 0 0 1 8 10.5C8 8 10 7 10 4.5"/><path d="M12 14a2 2 0 0 0-2 2c0 1.5 2 3 2 3s2-1.5 2-3a2 2 0 0 0-2-2z"/><path d="M5 22h14"/>'),
  'Washing machine': svgIcon('<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 5h1M12 5h4"/>'),
  'Microwave': svgIcon('<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="10" height="8" rx="1"/><path d="M18 9v1M18 13v2"/>'),
  'Induction stove': svgIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/>'),
};
const DEFAULT_APPLIANCE_ICON = svgIcon('<circle cx="12" cy="12" r="3"/>');

// ไอคอนแถวติดต่อเจ้าของห้อง
const CONTACT_ICONS = {
  phone: APPLIANCE_ICONS.HomePhone,
  email: svgIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>'),
  line: svgIcon('<path d="M21 11.5c0 4.1-4 7.5-9 7.5-1 0-2-.1-2.9-.4L4 21l1.4-3.6C4 16 3 13.9 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z"/>'),
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
      <a class="btn btn--primary" href="/search">Browse available rooms</a>
    </div>`;
}

// รูป 4 ช่อง: ใช้รูปจาก API ก่อน ช่องที่ไม่มีรูปเป็นกล่องเทา
// ช่องที่มีรูปเป็นปุ่ม กดแล้วเปิดดูเต็มจอ (lightbox)
let galleryPhotos = []; // url ของรูปทั้งหมดของห้อง (ใช้ใน lightbox)

function renderGallery(room) {
  galleryPhotos = [];
  for (const image of room.images || []) {
    galleryPhotos.push(image.url);
  }
  let html = '';
  for (let i = 0; i < GALLERY_SLOTS; i = i + 1) {
    const url = galleryPhotos[i] || '';
    const alt = 'Room ' + room.roomId + ' photo ' + (i + 1);
    if (url) {
      html += `<button type="button" class="gallery__item" data-index="${i}" aria-label="View ${escapeHtml(alt)} full screen">${imageHtml(url, alt)}</button>`;
    } else {
      html += `<div>${imageHtml(url, alt)}</div>`;
    }
  }
  document.getElementById('gallery').innerHTML = html;
  document.getElementById('photo-credit').classList.toggle('hidden', galleryPhotos.length === 0);
}

// ================= ดูรูปเต็มจอ =================
// ใช้ <dialog> ของเบราว์เซอร์: กด Esc ปิดได้เอง, ปุ่ม ‹ › หรือลูกศรซ้าย/ขวาเลื่อนรูป
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
let lightboxIndex = 0;

function showLightboxPhoto(index) {
  const total = galleryPhotos.length;
  lightboxIndex = (index + total) % total; // วนรอบ: ถัดจากรูปสุดท้ายคือรูปแรก
  let url = galleryPhotos[lightboxIndex];
  if (url.startsWith('/uploads/')) {
    url = API_ORIGIN + url;
  }
  lightboxImg.src = url;
  lightboxImg.alt = 'Photo ' + (lightboxIndex + 1) + ' of ' + total;
  document.getElementById('lightbox-count').textContent = (lightboxIndex + 1) + ' / ' + total;
  lightbox.classList.toggle('lightbox--single', total < 2);
}

document.getElementById('gallery').addEventListener('click', function (event) {
  const item = event.target.closest('.gallery__item');
  if (item) {
    showLightboxPhoto(Number(item.dataset.index));
    lightbox.showModal();
  }
});

lightbox.addEventListener('click', function (event) {
  const action = event.target.dataset.action;
  if (action === 'close' || event.target === lightbox) {
    lightbox.close(); // กดปุ่ม ✕ หรือพื้นที่มืดรอบรูป
  } else if (action === 'prev') {
    showLightboxPhoto(lightboxIndex - 1);
  } else if (action === 'next') {
    showLightboxPhoto(lightboxIndex + 1);
  }
});

lightbox.addEventListener('keydown', function (event) {
  if (event.key === 'ArrowLeft') {
    showLightboxPhoto(lightboxIndex - 1);
  } else if (event.key === 'ArrowRight') {
    showLightboxPhoto(lightboxIndex + 1);
  }
});

// ตัวอักษรย่อจากชื่อ เช่น "Wanchai Boonmee" -> "WB"
function initials(name) {
  let result = '';
  for (const word of String(name).trim().split(/\s+/).slice(0, 2)) {
    result += word.charAt(0).toUpperCase();
  }
  return result || '?';
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

// ชื่อห้อง ตึก กล่องข้อมูล 4 ช่อง (ประเภท · ห้องนอน · ขนาด · ชั้น) สภาพห้อง และคำอธิบาย
// (คะแนนสภาพห้องแสดงที่กล่อง "สภาพห้อง" ที่เดียว)
function renderSummary(room) {
  document.getElementById('room-title').textContent = 'Room ' + room.roomId;
  document.getElementById('room-building').textContent = room.building + ' · CONDONG condo';
  document.getElementById('room-facts').innerHTML = `
    <li><strong>${escapeHtml(room.roomType)}</strong><span>Room type</span></li>
    <li><strong>${escapeHtml(room.bedrooms)}</strong><span>Bedrooms</span></li>
    <li><strong>${escapeHtml(sizeText(room.size))}</strong><span>Usable area</span></li>
    <li><strong>${escapeHtml(room.floor)}</strong><span>Floor</span></li>`;
  document.getElementById('room-condition').innerHTML = conditionHtml(room.conditionRating);
  document.getElementById('room-description').textContent = room.description || 'No description yet.';
}

// การ์ดเจ้าของห้อง: วงกลมตัวย่อ + ชื่อ + แถวเบอร์ อีเมล LINE ID
// เบอร์และอีเมลเป็นลิงก์ (กดโทร / เปิดแอปอีเมลได้เลย)
function renderOwner(owner) {
  if (!owner) {
    owner = {};
  }
  const name = owner.name || 'Room owner';
  document.getElementById('owner-name').textContent = name;
  document.getElementById('owner-avatar').textContent = initials(name);

  const rows = [];
  if (owner.phone) {
    const digits = owner.phone.replace(/[^\d+]/g, '');
    rows.push({ icon: CONTACT_ICONS.phone, label: 'Phone', html: `<a href="tel:${escapeHtml(digits)}">${escapeHtml(owner.phone)}</a>` });
  }
  if (owner.email) {
    rows.push({ icon: CONTACT_ICONS.email, label: 'Email', html: `<a href="mailto:${escapeHtml(owner.email)}">${escapeHtml(owner.email)}</a>` });
  }
  if (owner.lineId) {
    rows.push({ icon: CONTACT_ICONS.line, label: 'LINE ID', html: escapeHtml(owner.lineId) });
  }
  let html = '';
  for (const row of rows) {
    html += `<li><span class="owner__icon">${row.icon}</span><span class="owner__label">${row.label}</span>${row.html}</li>`;
  }
  if (rows.length === 0) {
    html = '<li class="muted">No contact details yet.</li>';
  }
  document.getElementById('owner-rows').innerHTML = html;
}

// ไอคอนของเครื่องใช้ไฟฟ้า 1 ชนิด
function applianceIconHtml(name) {
  return APPLIANCE_ICONS[name] || DEFAULT_APPLIANCE_ICON;
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

// แสดงราคา USD โดยประมาณ แยกจากราคาหลักที่เป็นเงินบาท
async function showRentInUsd(price) {
  const output = document.getElementById('room-price-usd');
  try {
    const exchange = await getBahtToUsd();
    const amount = (price * exchange.rate).toLocaleString('en-US', {
      style: 'currency', currency: 'USD', currencyDisplay: 'code',
    });
    output.textContent = 'About ' + amount + ' / month (' + exchange.date + ')';
  } catch (error) {
    output.textContent = 'USD estimate unavailable';
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
    showRentInUsd(room.price);
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
  // มาจากหน้าค้นหา -> ลิงก์กลับไปผลค้นหาเดิม (พร้อมตัวกรองใน URL)
  if (document.referrer) {
    const from = new URL(document.referrer);
    if (from.origin === window.location.origin && from.pathname === '/search') {
      document.getElementById('back-link').href = from.pathname + from.search;
    }
  }
  const roomId = (getQueryParams().id || '').trim();
  if (ROOM_ID_PATTERN.test(roomId)) {
    loadRoom(roomId);
  } else {
    showNotFound();
  }
}

startRoomPage();
