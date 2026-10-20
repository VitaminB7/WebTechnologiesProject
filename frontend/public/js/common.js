// common.js — ฟังก์ชันที่ทุกหน้าใช้ร่วมกัน
// (กันโค้ดอันตราย escapeHtml, จัดรูปแบบราคา, การ์ดห้อง, ข้อความโหลด/ว่าง/ผิดพลาด,
//  แสดง error ในฟอร์ม, query string, แบ่งหน้า, ปุ่มบน header และตรวจการล็อกอินของหน้าแอดมิน)
// ต้องโหลดหลัง api.js และก่อนสคริปต์ของแต่ละหน้า

// ================= ค่าคงที่ =================

// ประเภทห้องที่ API รับ
const ROOM_TYPES = ['Studio', '1 Bedroom', '2 Bedroom', 'Deluxe room'];

// ชื่อเครื่องใช้ไฟฟ้าที่ฟอร์มแอดมินให้เลือก (ตาม API.md)
const APPLIANCES = [
  'Sofa', 'Water heater', 'Fridge', 'TV', 'HomePhone',
  'Air conditioner', 'Heater', 'Washing machine', 'Microwave', 'Induction stove',
];

// คำอธิบายคะแนนสภาพห้อง 1-5
const CONDITION_LABELS = { 1: 'แย่', 2: 'พอใช้', 3: 'สภาพดี', 4: 'ดีมาก', 5: 'ใหม่มาก' };

// ================= ข้อความ / ตัวเลข =================

// แปลงอักษรพิเศษให้เป็นข้อความธรรมดา กันโค้ด HTML/สคริปต์แปลกปลอมจาก API หรือผู้ใช้
// ใช้กับทุกค่าที่ใส่ใน innerHTML (รวมถึงค่าใน attribute)
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ราคาเป็นบาท เช่น 15000 -> "฿15,000"
function formatPrice(value) {
  const amount = Number(value);
  if (value === null || value === '' || !Number.isFinite(amount)) {
    return '-';
  }
  return '฿' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ขนาดห้อง เช่น 34 -> "34 m²" (ไม่มีข้อมูล -> "–")
function sizeText(size) {
  if (size === null || size === undefined) {
    return '–';
  }
  return Number(size) + ' m²';
}

// จำนวนห้องนอน เช่น 0 -> "Studio", 2 -> "2 bedrooms"
function bedroomText(bedrooms) {
  const count = Number(bedrooms);
  if (count === 0) {
    return 'Studio';
  }
  if (count === 1) {
    return '1 bedroom';
  }
  return count + ' bedrooms';
}

// สภาพห้อง เช่น 3 -> "3.0★ สภาพดี"
function conditionText(rating) {
  const value = Number(rating);
  if (!CONDITION_LABELS[value]) {
    return '-';
  }
  return value.toFixed(1) + '★ ' + CONDITION_LABELS[value];
}

// ================= รูปภาพ =================

// กล่องสีเทาแทนรูป (ใช้เมื่อไม่มีรูป หรือโหลดรูปไม่ขึ้น)
function placeholderHtml(label) {
  return `<div class="img-placeholder" role="img" aria-label="${escapeHtml(label)}">No image</div>`;
}

// แท็กรูป ถ้าไม่มี url ใช้กล่องเทาแทน ถ้าโหลดรูปพัง onerror จะเปลี่ยนเป็นกล่องเทา
function imageHtml(url, alt) {
  if (!url) {
    return placeholderHtml(alt);
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="showPlaceholder(this)">`;
}

// เรียกจาก onerror ของ <img>: เอากล่องเทามาแทนรูปที่โหลดไม่ขึ้น
function showPlaceholder(img) {
  img.onerror = null;
  img.outerHTML = placeholderHtml(img.alt);
}

// url ของรูปแรกของห้อง (ไม่มีรูป -> '')
function firstImageUrl(room) {
  if (room.images && room.images.length > 0) {
    return room.images[0].url;
  }
  return '';
}

// ================= ชิ้นส่วน HTML ที่ใช้ซ้ำ =================

// ป้ายสถานะห้อง: ว่าง (เขียว) / มีคนเช่า (เทา)
function statusBadge(available, availableText) {
  if (available) {
    return `<span class="badge badge--available">${escapeHtml(availableText || 'Available')}</span>`;
  }
  return '<span class="badge badge--occupied">Occupied</span>';
}

// การ์ดห้อง 1 ใบ (ใช้ในหน้าค้นหาและ "ห้องที่คล้ายกัน") กดแล้วไปหน้ารายละเอียด
function roomCard(room) {
  let ownerName = '';
  if (room.owner) {
    ownerName = room.owner.name;
  }
  const link = '/room.html?id=' + encodeURIComponent(room.roomId);
  return `
    <a class="card room-card" href="${escapeHtml(link)}">
      <div class="room-card__media">
        ${imageHtml(firstImageUrl(room), 'Room ' + room.roomId)}
        <span class="room-card__fav" aria-hidden="true">♡</span>
      </div>
      <div class="room-card__body">
        <p class="room-card__title">Room ${escapeHtml(room.roomId)}</p>
        <p class="room-card__owner">${escapeHtml(ownerName)}</p>
        <p class="room-card__price">${escapeHtml(formatPrice(room.price))} / month</p>
        <p class="room-card__meta">${escapeHtml(bedroomText(room.bedrooms))} · ${escapeHtml(sizeText(room.size))}</p>
      </div>
    </a>`;
}

// แสดงข้อความสถานะในกล่อง: type = 'loading' | 'empty' | 'error'
function showState(container, type, message, title) {
  let role = 'status';
  if (type === 'error') {
    role = 'alert';
  }
  let titleHtml = '';
  if (title) {
    titleHtml = `<p class="state__title">${escapeHtml(title)}</p>`;
  }
  container.innerHTML = `
    <div class="state state--${escapeHtml(type)}" role="${role}">
      ${titleHtml}
      <p>${escapeHtml(message)}</p>
    </div>`;
}

// ================= ปุ่ม / ข้อความเด้ง =================

// ปิดปุ่มระหว่างรอ และเปลี่ยนข้อความ เช่น "Saving..." แล้วคืนข้อความเดิมเมื่อเสร็จ
function setBusy(button, busy, busyLabel) {
  if (busy) {
    if (button.dataset.label === undefined) {
      button.dataset.label = button.textContent;
    }
    button.textContent = busyLabel || 'Saving...';
    button.disabled = true;
  } else {
    if (button.dataset.label !== undefined) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
    button.disabled = false;
  }
}

// ข้อความเด้งมุมขวาล่าง หายเองใน 4 วินาที (type = 'info' | 'success' | 'error')
function showToast(message, type) {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'info');
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 4000);
}

// ================= Error ในฟอร์ม =================

// ล้าง error เก่าทั้งหมดในฟอร์ม
function clearFieldErrors(form) {
  for (const message of form.querySelectorAll('.field-error')) {
    message.remove();
  }
  for (const input of form.querySelectorAll('.is-invalid')) {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  }
  const formError = form.querySelector('.form-error');
  if (formError) {
    formError.classList.add('hidden');
  }
}

// แสดงข้อความผิดใต้ช่องที่มี name ตรงกับ key (เช่น { price: 'must be ...' })
// คืนรายการข้อความที่หาช่องไม่เจอ เพื่อเอาไปแสดงรวมด้านบน
function showFieldErrors(form, fields) {
  const unmatched = [];
  for (const name of Object.keys(fields || {})) {
    const message = fields[name];
    let firstInput = null;
    for (const input of form.elements) {
      if (input.name === name) {
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        if (!firstInput) firstInput = input;
      }
    }
    if (!firstInput) {
      unmatched.push(name + ': ' + message);
      continue;
    }
    const wrapper = firstInput.closest('.field, fieldset');
    wrapper.insertAdjacentHTML('beforeend', `<p class="field-error">${escapeHtml(message)}</p>`);
  }
  return unmatched;
}

// แสดงข้อความผิดรวมของฟอร์ม (กล่องแดง .form-error) ถ้าไม่มีกล่องให้เด้งเป็น toast
function showFormError(form, message) {
  const box = form.querySelector('.form-error');
  if (!box) {
    showToast(message, 'error');
    return;
  }
  box.textContent = message;
  box.classList.remove('hidden');
}

// แสดง error จาก API (หรือจากการตรวจเอง) ในฟอร์ม: ข้อความรายช่อง + ข้อความรวม
function showApiError(form, error) {
  clearFieldErrors(form);
  const unmatched = showFieldErrors(form, error.fields);
  const parts = [];
  if (error.message) parts.push(error.message);
  for (const text of unmatched) parts.push(text);
  if (parts.length > 0) {
    showFormError(form, parts.join(' — '));
  }
  const firstInvalid = form.querySelector('.is-invalid');
  if (firstInvalid) {
    firstInvalid.focus();
  }
}

// ================= Query string ใน URL =================

// อ่าน ?a=1&b=2 จาก URL เป็น object { a: '1', b: '2' }
function getQueryParams() {
  const params = {};
  const search = new URLSearchParams(window.location.search);
  for (const pair of search) {
    params[pair[0]] = pair[1];
  }
  return params;
}

// เขียน object ลง URL (ไม่โหลดหน้าใหม่) ข้ามค่าว่าง
function setQueryParams(params) {
  const search = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  }
  let url = window.location.pathname;
  const text = search.toString();
  if (text !== '') {
    url = url + '?' + text;
  }
  window.history.pushState(null, '', url);
}

// แปลงข้อความเป็นจำนวนเต็มบวก ถ้าไม่ใช่คืน null
function toPositiveInt(value) {
  const text = String(value || '').trim();
  if (/^\d+$/.test(text) && Number(text) > 0) {
    return Number(text);
  }
  return null;
}

// ================= แบ่งหน้า =================

// วาดปุ่ม ‹ Prev 1 2 3 Next › แล้วเรียก onPage(เลขหน้า) เมื่อกด
function renderPagination(container, meta, onPage) {
  container.innerHTML = '';
  if (!meta || !meta.total) {
    return;
  }
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (totalPages <= 1) {
    return;
  }
  const page = Math.min(Math.max(1, meta.page), totalPages);
  // แสดงเลขหน้าไม่เกิน 5 ปุ่มรอบหน้าปัจจุบัน
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);

  let html = `<button type="button" data-page="${page - 1}" aria-label="Previous page" ${page === 1 ? 'disabled' : ''}>‹ Prev</button>`;
  for (let n = first; n <= last; n = n + 1) {
    const current = n === page ? 'aria-current="page"' : '';
    html += `<button type="button" data-page="${n}" ${current}>${n}</button>`;
  }
  html += `<button type="button" data-page="${page + 1}" aria-label="Next page" ${page === totalPages ? 'disabled' : ''}>Next ›</button>`;
  container.innerHTML = html;

  for (const button of container.querySelectorAll('button')) {
    button.addEventListener('click', function () {
      onPage(Number(button.dataset.page));
    });
  }
}

// ข้อความ "Showing 1-6 of 20 rooms"
function rangeText(meta, count, noun) {
  if (!meta || !meta.total) {
    return 'Showing 0 ' + noun;
  }
  const start = (meta.page - 1) * meta.pageSize + 1;
  return 'Showing ' + start + '-' + (start + count - 1) + ' of ' + meta.total + ' ' + noun;
}

// ================= Header / ล็อกอิน =================

// กดปุ่ม Logout: ออกจากระบบแล้วกลับหน้าแรก
async function handleLogout(button) {
  setBusy(button, true, 'Logging out...');
  try {
    await logout();
    window.location.href = '/index.html';
  } catch (error) {
    setBusy(button, false);
    showToast(error.message, 'error');
  }
}

// ผูกปุ่ม Logout (id="logout-button") ถ้ามีอยู่ในหน้า
function bindLogoutButton() {
  const button = document.getElementById('logout-button');
  if (button) {
    button.addEventListener('click', function () {
      handleLogout(button);
    });
  }
}

// header หน้าสาธารณะ: ใส่ปุ่ม Login หรือ (ถ้าล็อกอินอยู่) ปุ่ม Admin + Logout
// showLogin = false ในหน้า login (ไม่ต้องมีปุ่ม Login ซ้ำ)
async function setupPublicHeader(showLogin) {
  const actions = document.getElementById('header-actions');
  try {
    await getMe();
    actions.innerHTML = `
      <a class="btn btn--outline btn--sm" href="/admin/rooms.html">Admin</a>
      <button id="logout-button" type="button" class="btn btn--dark btn--sm">Logout</button>`;
    bindLogoutButton();
  } catch (error) {
    if (showLogin) {
      actions.innerHTML = '<a class="btn btn--dark btn--sm" href="/login.html">Login</a>';
    }
  }
}

// header หน้าแอดมิน: แสดงชื่อคนที่ล็อกอิน และโชว์ลิงก์ "User management" เฉพาะ SuperAdmin
function setupAdminHeader(admin) {
  document.getElementById('admin-user').textContent = admin.displayName + ' (' + admin.role + ')';
  if (admin.role === 'SuperAdmin') {
    document.getElementById('nav-accounts').classList.remove('hidden');
  }
  bindLogoutButton();
}

// หน้าแอดมิน: ตรวจว่าล็อกอินแล้ว คืนข้อมูล Admin
// ถ้ายังไม่ล็อกอิน (401) ส่งไปหน้า login แล้วคืน null / error อื่นแสดงใน container
async function requireAdmin(container) {
  try {
    return await getMe();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('/login.html');
    } else {
      showState(container, 'error', error.message, 'Could not verify your session');
    }
    return null;
  }
}
