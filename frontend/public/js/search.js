// search.js — สคริปต์หน้าค้นหาห้อง
// ตัวกรองและเลขหน้าเก็บไว้ใน URL (?type=Studio&page=2) เสมอ
// ดังนั้นกดรีเฟรช / ย้อนกลับ / ส่งลิงก์ให้เพื่อน ก็ได้ผลลัพธ์เดิม

// ชื่อช่องตัวกรอง (ตรงกับ name ใน search.html และชื่อ query ของ API)
const FILTER_NAMES = ['type', 'floor', 'minCondition', 'minPrice', 'maxPrice'];
// ห้องต่อหน้า: แถวแรก 2 ใบ + 3 แถว แถวละ 3 ใบ = 11 ใบ (ตาม Figma)
const PAGE_SIZE = 11;

const filterForm = document.getElementById('filter-form');
const results = document.getElementById('results');
const resultsCount = document.getElementById('results-count');
const pagination = document.getElementById('pagination');
let latestRequestId = 0; // กันผลลัพธ์เก่ามาทับผลลัพธ์ใหม่ เมื่อกดค้นหาเร็ว ๆ หลายครั้ง

// เอาค่าจาก URL มาใส่ในฟอร์ม
function fillFilterForm(params) {
  for (const name of FILTER_NAMES) {
    filterForm.elements[name].value = params[name] || '';
  }
  filterForm.elements.available.checked = params.available === 'true';
}

// อ่านค่าจากฟอร์ม (เอาเฉพาะช่องที่กรอก)
function readFilterForm() {
  const filters = {};
  for (const name of FILTER_NAMES) {
    const value = filterForm.elements[name].value.trim();
    if (value !== '') {
      filters[name] = value;
    }
  }
  if (filterForm.elements.available.checked) {
    filters.available = 'true';
  }
  return filters;
}

// ตรวจตัวกรองก่อนส่ง คืน object ข้อความผิด (ว่าง = ผ่าน)
function validateFilters(filters) {
  const fields = {};
  const floor = toPositiveInt(filters.floor);
  if (filters.floor && (floor === null || floor > 99)) {
    fields.floor = 'Floor must be a whole number from 1 to 99';
  }
  if (filters.minPrice && !(Number(filters.minPrice) >= 0)) {
    fields.minPrice = 'Price must be 0 or more';
  }
  if (filters.maxPrice && !(Number(filters.maxPrice) >= 0)) {
    fields.maxPrice = 'Price must be 0 or more';
  }
  if (!fields.minPrice && !fields.maxPrice && filters.minPrice && filters.maxPrice) {
    if (Number(filters.minPrice) > Number(filters.maxPrice)) {
      fields.maxPrice = 'Max price must not be lower than min price';
    }
  }
  return fields;
}

// วาดการ์ดผลลัพธ์ + จำนวนที่เจอ + ปุ่มแบ่งหน้า
function renderResults(rooms, meta) {
  let total = rooms.length;
  if (meta) {
    total = meta.total;
  }
  resultsCount.textContent = total + ' room(s) found';

  if (rooms.length === 0) {
    showState(results, 'empty', 'Try widening the price range or clearing some filters.', 'No rooms match your search');
  } else {
    let html = '';
    for (const room of rooms) {
      html += roomCard(room);
    }
    results.innerHTML = html;
  }
  renderPagination(pagination, meta, goToPage);
}

// ค้นหาตามค่าใน URL ตอนนี้ (เรียกตอนเปิดหน้า, กดค้นหา, เปลี่ยนหน้า, กดย้อนกลับ)
async function runSearch() {
  const params = getQueryParams();
  fillFilterForm(params);
  const filters = readFilterForm();
  pagination.innerHTML = '';
  resultsCount.textContent = '';

  const fields = validateFilters(filters);
  if (Object.keys(fields).length > 0) {
    showApiError(filterForm, { message: 'Please fix the highlighted filters.', fields: fields });
    showState(results, 'empty', 'Fix the highlighted filters to see rooms.');
    return;
  }
  clearFieldErrors(filterForm);

  filters.page = toPositiveInt(params.page) || 1;
  filters.pageSize = PAGE_SIZE;
  latestRequestId = latestRequestId + 1;
  const requestId = latestRequestId;
  showState(results, 'loading', 'Loading rooms...');
  try {
    const answer = await listRooms(filters);
    if (requestId === latestRequestId) {
      renderResults(answer.data, answer.meta);
    }
  } catch (error) {
    if (requestId !== latestRequestId) {
      return;
    }
    showState(results, 'error', error.message, 'Could not load rooms');
    if (Object.keys(error.fields).length > 0) {
      showApiError(filterForm, error);
    }
  }
}

// กดเปลี่ยนหน้า: เขียนเลขหน้าลง URL แล้วค้นหาใหม่
function goToPage(page) {
  const params = readFilterForm();
  if (page > 1) {
    params.page = page;
  }
  setQueryParams(params);
  runSearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// กดปุ่ม "Search Room": เขียนตัวกรองลง URL (กลับไปหน้า 1) แล้วค้นหา
function handleFilterSubmit(event) {
  event.preventDefault();
  const filters = readFilterForm();
  const fields = validateFilters(filters);
  if (Object.keys(fields).length > 0) {
    showApiError(filterForm, { message: 'Please fix the highlighted filters.', fields: fields });
    return;
  }
  setQueryParams(filters);
  runSearch();
}

// กด "Clear all filters": ล้างฟอร์มและ URL แล้วค้นหาใหม่
function handleClearFilters() {
  filterForm.reset();
  setQueryParams({});
  runSearch();
}

filterForm.addEventListener('submit', handleFilterSubmit);
document.getElementById('clear-filters').addEventListener('click', handleClearFilters);
window.addEventListener('popstate', runSearch); // ปุ่มย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์

setupPublicHeader();
runSearch();
