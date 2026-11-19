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

// ================= รูปภาพ =================

// กล่องสีเทาแทนรูป (ใช้เมื่อไม่มีรูป หรือโหลดรูปไม่ขึ้น) — ใน Figma เป็นกล่องเทา ไม่มีตัวหนังสือ
// มีไอคอนรูปภาพจาง ๆ ตรงกลางให้รู้ว่าเป็นช่องรูป
const PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-9 9"/></svg>';

function placeholderHtml(label) {
  return `<div class="img-placeholder" role="img" aria-label="${escapeHtml(label)} (no image)">${PLACEHOLDER_ICON}</div>`;
}

// แท็กรูป ถ้าไม่มี url ใช้กล่องเทาแทน ถ้าโหลดรูปพัง onerror จะเปลี่ยนเป็นกล่องเทา
function imageHtml(url, alt) {
  if (!url) {
    return placeholderHtml(alt);
  }
  if (url.startsWith('/uploads/')) {
    url = API_ORIGIN + url;
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

// ================= ห้องที่ชอบ (♡ บนการ์ด) =================
// เก็บรหัสห้องที่กดหัวใจไว้ใน localStorage ของเบราว์เซอร์ (เฉพาะเครื่องนี้)
// ถ้าเบราว์เซอร์ไม่ให้ใช้ localStorage (เช่น โหมดส่วนตัว) หัวใจยังกดได้ แค่ไม่จำ
const FAVORITES_KEY = 'condong-favorites';

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (error) {
    // ไม่จำก็ไม่เป็นไร
  }
}

// กดปุ่มหัวใจ: สลับชอบ/ไม่ชอบ
function toggleFavorite(button) {
  const roomId = button.dataset.roomId;
  let list = getFavorites();
  const liked = !list.includes(roomId);
  if (liked) {
    list.push(roomId);
  } else {
    list = list.filter(function (id) {
      return id !== roomId;
    });
  }
  saveFavorites(list);
  button.setAttribute('aria-pressed', String(liked));
}

// ปุ่มหัวใจอยู่ในการ์ดที่สร้างใหม่ทุกครั้ง จึงฟังคลิกที่ document ทีเดียว
document.addEventListener('click', function (event) {
  const button = event.target.closest('.fav-button');
  if (button) {
    toggleFavorite(button);
  }
});

const HEART_ICON = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.6 8 3.5 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.5 0 5.4 3.5 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z"/></svg>';

// การ์ดห้องในหน้าค้นหา
// กดการ์ดเพื่อไปหน้ารายละเอียด / ปุ่ม ♡ อยู่นอกลิงก์ กดแล้วไม่เปลี่ยนหน้า
function roomCard(room) {
  let ownerName = '';
  if (room.owner) {
    ownerName = room.owner.name;
  }
  const link = '/room?id=' + encodeURIComponent(room.roomId);
  const liked = getFavorites().includes(room.roomId);
  return `
    <article class="room-card">
      <a class="room-card__link" href="${escapeHtml(link)}">
        <div class="room-card__media">
          ${imageHtml(firstImageUrl(room), 'Room ' + room.roomId)}
          <span class="room-card__tag">${escapeHtml(room.roomType)}</span>
        </div>
        <div class="room-card__body">
          <p class="room-card__title">Room ${escapeHtml(room.roomId)}</p>
          <p class="room-card__owner">${escapeHtml(ownerName)}</p>
          <p class="room-card__price">${escapeHtml(formatPrice(room.price))} / month</p>
          <p class="room-card__meta">${escapeHtml(bedroomText(room.bedrooms))} &nbsp;• ${escapeHtml(sizeText(room.size))}</p>
        </div>
      </a>
      <button type="button" class="fav-button" data-room-id="${escapeHtml(room.roomId)}"
        aria-pressed="${liked}" aria-label="Save room ${escapeHtml(room.roomId)}">${HEART_ICON}</button>
    </article>`;
}

// ================= Dropdown ของเราเอง =================
// รายการของ <select> ปกติเบราว์เซอร์วาดเอง แต่งด้วย CSS ไม่ได้ จึงสร้างปุ่ม + รายการ (listbox) แทน
// <select> ตัวจริงยังอยู่ (ซ่อนไว้) และเก็บค่าที่เลือก ฟอร์มจึงส่งค่าได้เหมือนเดิม
// ช่องที่กดเปิดได้ = กล่องที่มี data-dropdown (ถ้าไม่มี จะห่อ select ด้วย <div class="dropdown"> ให้)
const CHECK_ICON = '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"/></svg>';
let openDropdown = null; // dropdown ที่เปิดอยู่ (เปิดได้ทีละอัน)

function enhanceSelect(select) {
  let box = select.closest('[data-dropdown]');
  if (!box) {
    box = document.createElement('div');
    box.className = 'dropdown';
    select.before(box);
    box.appendChild(select);
  }
  box.classList.add('dropdown-box');
  const label = document.querySelector('label[for="' + select.id + '"]');
  const buttonId = select.id + '-button';
  const listId = select.id + '-list';

  const button = document.createElement('button');
  button.type = 'button';
  button.id = buttonId;
  button.className = 'dropdown__button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', listId);

  const list = document.createElement('ul');
  list.id = listId;
  list.className = 'dropdown__list';
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  list.hidden = true;

  if (label) {
    label.id = select.id + '-label';
    label.htmlFor = buttonId;
    button.setAttribute('aria-labelledby', label.id + ' ' + buttonId);
    list.setAttribute('aria-labelledby', label.id);
  }

  const options = [];
  for (let i = 0; i < select.options.length; i = i + 1) {
    const item = document.createElement('li');
    item.id = listId + '-' + i;
    item.className = 'dropdown__option';
    item.setAttribute('role', 'option');
    item.innerHTML = `<span>${escapeHtml(select.options[i].textContent)}</span>${CHECK_ICON}`;
    list.appendChild(item);
    options.push(item);
  }

  select.classList.add('dropdown__native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(button);
  box.appendChild(list);

  let activeIndex = Math.max(0, select.selectedIndex);

  // วาดข้อความบนปุ่ม + ติ๊กถูกตัวที่เลือก
  function render() {
    const selected = Math.max(0, select.selectedIndex);
    button.textContent = select.options[selected].textContent;
    button.disabled = select.disabled; // select ถูกล็อก -> ปุ่มกดไม่ได้ด้วย
    for (let i = 0; i < options.length; i = i + 1) {
      options[i].setAttribute('aria-selected', String(i === selected));
      options[i].classList.toggle('is-active', i === activeIndex);
    }
    list.setAttribute('aria-activedescendant', options[activeIndex].id);
  }

  function open() {
    if (openDropdown && openDropdown !== api) {
      openDropdown.close(false);
    }
    activeIndex = Math.max(0, select.selectedIndex);
    render();
    list.hidden = false;
    box.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    list.focus();
    options[activeIndex].scrollIntoView({ block: 'nearest' });
    openDropdown = api;
  }

  function close(focusButton) {
    list.hidden = true;
    box.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    if (openDropdown === api) {
      openDropdown = null;
    }
    if (focusButton) {
      button.focus();
    }
  }

  function choose(index) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    activeIndex = index;
    render();
    close(true);
  }

  function moveActive(index) {
    activeIndex = Math.max(0, Math.min(options.length - 1, index));
    render();
    options[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  // กดตรงไหนของช่องก็เปิด/ปิดได้
  box.addEventListener('click', function (event) {
    // คลิก label: เบราว์เซอร์ส่งคลิกต่อให้ปุ่มเองอีกครั้ง ไม่ต้อง toggle ซ้ำ
    if (list.contains(event.target) || event.target === label || select.disabled) {
      return;
    }
    if (list.hidden) {
      open();
    } else {
      close(true);
    }
  });

  list.addEventListener('click', function (event) {
    const item = event.target.closest('.dropdown__option');
    if (item) {
      choose(options.indexOf(item));
    }
  });

  list.addEventListener('mousemove', function (event) {
    const item = event.target.closest('.dropdown__option');
    if (item && options.indexOf(item) !== activeIndex) {
      activeIndex = options.indexOf(item);
      render();
    }
  });

  button.addEventListener('keydown', function (event) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });

  list.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveActive(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    }
  });

  const api = { close: close, box: box };
  // ถ้าโค้ดอื่นเปลี่ยน select.value เอง (เช่น อ่านค่าจาก URL / reset ฟอร์ม) ให้เรียก refreshDropdowns()
  select.refreshDropdown = function () {
    activeIndex = Math.max(0, select.selectedIndex);
    render();
  };
  render();
}

// เปลี่ยนทุก <select> ใน container ให้เป็น dropdown แบบของเราเอง
function enhanceSelects(container) {
  for (const select of container.querySelectorAll('select')) {
    enhanceSelect(select);
  }
}

// อัปเดตข้อความบนปุ่ม dropdown หลังเปลี่ยนค่า select ด้วยโค้ด
function refreshDropdowns(container) {
  for (const select of container.querySelectorAll('select')) {
    if (select.refreshDropdown) {
      select.refreshDropdown();
    }
  }
}

// คลิกนอก dropdown -> ปิด
document.addEventListener('click', function (event) {
  if (openDropdown && !openDropdown.box.contains(event.target)) {
    openDropdown.close(false);
  }
});

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

// วาดปุ่ม Previous 1 2 3 Next แล้วเรียก onPage(เลขหน้า) เมื่อกด
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

  let html = `<button type="button" data-page="${page - 1}" aria-label="Previous page" ${page === 1 ? 'disabled' : ''}>Previous</button>`;
  for (let n = first; n <= last; n = n + 1) {
    const current = n === page ? 'aria-current="page"' : '';
    html += `<button type="button" data-page="${n}" ${current}>${n}</button>`;
  }
  html += `<button type="button" data-page="${page + 1}" aria-label="Next page" ${page === totalPages ? 'disabled' : ''}>Next</button>`;
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
    window.location.href = '/';
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

// เพิ่มปุ่ม hamburger ให้ header (แสดงเฉพาะจอเล็ก ดู style.css) และเงาใต้ header ตอนเลื่อนหน้า
// เรียกเองตอนโหลด common.js เพราะทุกหน้ามี #site-header และโหลดสคริปต์ไว้ท้าย body
function setupNavToggle() {
  const header = document.getElementById('site-header');
  if (!header) {
    return;
  }
  const inner = header.querySelector('.site-header__inner');
  const nav = header.querySelector('.site-nav');
  if (nav && inner) {
    nav.id = nav.id || 'site-nav';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.innerHTML = '<span class="nav-toggle__bars" aria-hidden="true"></span>';
    inner.appendChild(toggle);

    toggle.addEventListener('click', function () {
      const open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function updateShadow() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', updateShadow, { passive: true });
  updateShadow();
}

setupNavToggle();

// ปุ่มวงรีขวาบนของ header (ไอคอนคน + ข้อความ) เหมือนใน Figma
function accountPillHtml(href, label) {
  return `<a class="account-pill" href="${escapeHtml(href)}"><img src="/img/icon-user.svg" alt=""><span>${escapeHtml(label)}</span></a>`;
}

// header หน้าสาธารณะ: ปุ่ม Login (ยังไม่ล็อกอิน) หรือปุ่ม Admin ไปหน้าแอดมิน (ล็อกอินอยู่)
// HTML ของทุกหน้ามีปุ่ม Login ไว้ก่อนแล้ว ถ้าล็อกอินอยู่จะเปลี่ยนเป็นปุ่ม Admin
async function setupPublicHeader() {
  const actions = document.getElementById('header-actions');
  try {
    await getMe();
    actions.innerHTML = accountPillHtml('/admin/rooms', 'Admin');
  } catch (error) {
    actions.innerHTML = accountPillHtml('/login', 'Login');
  }
}

// header หน้าแอดมิน: ชื่อคนที่ล็อกอินอยู่ขึ้นเมื่อเอาเมาส์ชี้ปุ่ม Logout
// และโชว์ลิงก์ "User management" เฉพาะ SuperAdmin
function setupAdminHeader(admin) {
  document.getElementById('logout-button').title = 'Logged in as ' + admin.displayName + ' (' + admin.role + ')';
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
      window.location.replace('/login');
    } else {
      showState(container, 'error', error.message, 'Could not verify your session');
    }
    return null;
  }
}
