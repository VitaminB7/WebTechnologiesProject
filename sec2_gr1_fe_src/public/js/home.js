// home.js — สคริปต์หน้าแรก
// 1) ตัวเลขโครงการ (จำนวนห้องว่าง, ราคาเริ่มต้น) จาก API
// 2) ห้องว่างแนะนำ 3 ห้อง (ใช้ roomCard เดียวกับหน้าค้นหา)
// 3) ฟอร์มค้นหาด่วน: ส่งเฉพาะช่องที่เลือกไปหน้า /search

const FEATURED_COUNT = 3;

const featuredRooms = document.getElementById('featured-rooms');
const quickSearch = document.getElementById('quick-search');

// ห้องว่างแนะนำ + จำนวนห้องว่าง (meta.total ของคำค้นเดียวกัน)
async function loadFeatured() {
  showState(featuredRooms, 'loading', 'Loading rooms...');
  try {
    const result = await listRooms({ available: 'true', pageSize: FEATURED_COUNT });
    if (result.meta) {
      document.getElementById('stat-available').textContent = result.meta.total;
    }
    if (result.data.length === 0) {
      showState(featuredRooms, 'empty', 'Please check back soon.', 'No rooms available right now');
      return;
    }
    featuredRooms.innerHTML = result.data.map(roomCard).join('');
  } catch (error) {
    showState(featuredRooms, 'error', error.message, 'Could not load rooms');
  }
}

// ราคาเริ่มต้น = ห้องว่างที่ถูกที่สุด
async function loadStartingPrice() {
  try {
    const result = await listRooms({ available: 'true', sort: 'price_asc', pageSize: 1 });
    if (result.data.length > 0) {
      document.getElementById('stat-from').textContent = formatPrice(result.data[0].price);
    }
  } catch (error) {
    // ไม่แสดง error ซ้ำ (ส่วนห้องแนะนำแสดงให้แล้ว) ปล่อยเป็น "–"
  }
}

// ส่งเฉพาะช่องที่เลือก จะได้ URL สั้น เช่น /search?type=Studio&available=true
function handleQuickSearch(event) {
  event.preventDefault();
  const params = new URLSearchParams();
  const type = quickSearch.elements.type.value;
  const maxPrice = quickSearch.elements.maxPrice.value;
  if (type) {
    params.set('type', type);
  }
  if (maxPrice) {
    params.set('maxPrice', maxPrice);
  }
  if (quickSearch.elements.available.checked) {
    params.set('available', 'true');
  }
  const query = params.toString();
  window.location.href = '/search' + (query ? '?' + query : '');
}

enhanceSelects(quickSearch); // dropdown แบบของเราเอง (common.js)
quickSearch.addEventListener('submit', handleQuickSearch);
setupPublicHeader();
loadFeatured();
loadStartingPrice();
