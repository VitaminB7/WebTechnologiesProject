// api.js — ไฟล์เดียวที่คุยกับ back end (เรียก fetch)
// มี 1 ฟังก์ชันต่อ 1 endpoint ตาม docs/API.md
// ถ้าสำเร็จ: คืนค่า data ที่ back end ส่งมา (หน้า list คืน { data, meta })
// ถ้าพลาด: throw Error ที่มี error.status (เลข HTTP) และ error.fields (ข้อความผิดรายช่อง)

// สร้าง Error หนึ่งตัว พร้อมแนบเลขสถานะและข้อความผิดรายช่อง
function makeApiError(status, message, fields) {
  const error = new Error(message);
  error.status = status;
  error.fields = fields || {};
  return error;
}

// แปลง object เป็น query string เช่น { type: 'Studio', page: 2 } -> "?type=Studio&page=2" (ข้ามค่าว่าง)
function buildQuery(params) {
  const search = new URLSearchParams();
  if (params) {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, value);
      }
    }
  }
  const text = search.toString();
  if (text === '') {
    return '';
  }
  return '?' + text;
}

// อ่าน JSON จากคำตอบ (ถ้าไม่ใช่ JSON หรืออ่านไม่ได้ คืน null)
async function readJson(response) {
  const type = response.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) {
    return null;
  }
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

// ส่งคำขอไป back end แล้วคืน JSON ทั้งก้อน ({ data, meta })
// body = object (ส่งเป็น JSON) หรือ FormData (ส่งไฟล์รูป)
async function apiRequest(method, url, body) {
  const options = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body instanceof FormData) {
    options.body = body; // ไม่ต้องตั้ง Content-Type เอง เบราว์เซอร์ใส่ boundary ให้
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw makeApiError(0, 'Cannot reach the server. Please check your connection and try again.');
  }

  const json = await readJson(response);
  if (!response.ok) {
    let message = 'Request failed (' + response.status + ')';
    let fields = {};
    if (json && json.error) {
      if (json.error.message) message = json.error.message;
      if (json.error.fields) fields = json.error.fields;
    }
    throw makeApiError(response.status, message, fields);
  }
  if (json === null) {
    return {};
  }
  return json;
}

// ทำให้ค่าใน URL ปลอดภัย เช่น "L-1201" หรือ username
function urlPart(value) {
  return encodeURIComponent(value);
}

// ================= Auth =================

// ล็อกอิน (username หรือ email + password) คืนข้อมูล Admin
async function login(username, password) {
  const json = await apiRequest('POST', '/api/auth/login', { username: username, password: password });
  return json.data;
}

// ออกจากระบบ
async function logout() {
  const json = await apiRequest('POST', '/api/auth/logout');
  return json.data;
}

// ถามว่าตอนนี้ใครล็อกอินอยู่ (ไม่ได้ล็อกอิน -> error.status = 401)
async function getMe() {
  const json = await apiRequest('GET', '/api/auth/me');
  return json.data;
}

// ================= Rooms (ทุกคนดูได้) =================

// ค้นหาห้อง คืน { data: Room[], meta: { page, pageSize, total } }
async function listRooms(params) {
  const json = await apiRequest('GET', '/api/rooms' + buildQuery(params));
  return { data: json.data || [], meta: json.meta || null };
}

// ดึงห้องเดียวตามรหัส เช่น "L-1201"
async function getRoom(roomId) {
  const json = await apiRequest('GET', '/api/rooms/' + urlPart(roomId));
  return json.data;
}

// ห้องที่คล้ายกัน (ไม่เกิน 3 ห้อง)
async function getSimilarRooms(roomId) {
  const json = await apiRequest('GET', '/api/rooms/' + urlPart(roomId) + '/similar');
  return json.data || [];
}

// ตัวเลขสรุปสำหรับหน้าแรก { totalRooms, roomTypes, availableRooms }
async function getStats() {
  const json = await apiRequest('GET', '/api/stats');
  return json.data;
}

// ================= Rooms (ต้องล็อกอิน) =================

// เพิ่มห้องใหม่
async function createRoom(room) {
  const json = await apiRequest('POST', '/api/rooms', room);
  return json.data;
}

// แก้ไขห้อง (ส่งข้อมูลทั้งห้อง)
async function updateRoom(roomId, room) {
  const json = await apiRequest('PUT', '/api/rooms/' + urlPart(roomId), room);
  return json.data;
}

// ลบห้อง
async function deleteRoom(roomId) {
  const json = await apiRequest('DELETE', '/api/rooms/' + urlPart(roomId));
  return json.data;
}

// อัปโหลดรูปห้อง (files = รายการไฟล์ ไม่เกิน 5 ไฟล์) คืน Room ที่มีรูปใหม่แล้ว
async function uploadRoomImages(roomId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file); // ชื่อช่องต้องเป็น "images" ตาม API
  }
  const json = await apiRequest('POST', '/api/rooms/' + urlPart(roomId) + '/images', formData);
  return json.data;
}

// ลบรูปห้องหนึ่งรูป คืน Room ที่เหลือรูปแล้ว
async function deleteRoomImage(roomId, imageId) {
  const json = await apiRequest('DELETE', '/api/rooms/' + urlPart(roomId) + '/images/' + urlPart(imageId));
  return json.data;
}

// ================= Admin accounts (SuperAdmin เท่านั้น) =================

// รายชื่อผู้ดูแล กรองด้วย { q, role, email } (ใส่กี่ช่องก็ได้)
async function listAdmins(params) {
  const json = await apiRequest('GET', '/api/admins' + buildQuery(params));
  return json.data || [];
}

// ดึงผู้ดูแลหนึ่งคน
async function getAdmin(username) {
  const json = await apiRequest('GET', '/api/admins/' + urlPart(username));
  return json.data;
}

// เพิ่มผู้ดูแลใหม่
async function createAdmin(admin) {
  const json = await apiRequest('POST', '/api/admins', admin);
  return json.data;
}

// แก้ไขผู้ดูแล (ไม่ส่ง password = ใช้รหัสเดิม)
async function updateAdmin(username, admin) {
  const json = await apiRequest('PUT', '/api/admins/' + urlPart(username), admin);
  return json.data;
}

// ลบผู้ดูแล
async function deleteAdmin(username) {
  const json = await apiRequest('DELETE', '/api/admins/' + urlPart(username));
  return json.data;
}

// ตั้งรหัสผ่านใหม่ให้ผู้ดูแล
async function resetAdminPassword(username, password) {
  const json = await apiRequest('POST', '/api/admins/' + urlPart(username) + '/reset-password', { password: password });
  return json.data;
}

// ================= Logs (SuperAdmin เท่านั้น) =================

// ประวัติการแก้ไขล่าสุด 100 รายการ (ตอนนี้ยังไม่มีหน้าไหนใช้ เตรียมไว้ให้ครบตาม API)
async function listLogs() {
  const json = await apiRequest('GET', '/api/logs');
  return json.data || [];
}
