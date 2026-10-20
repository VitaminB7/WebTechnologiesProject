// The only module that talks to the back end. One function per endpoint in docs/API.md.
// Every function resolves with the response `data` (list endpoints: `{ data, meta }`)
// and rejects with ApiError on any non-2xx response or network failure.

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function readJson(response) {
  const type = response.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(method, path, { query, body, formData } = {}) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path + buildQuery(query), options);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const error = (payload && payload.error) || {};
    throw new ApiError(response.status, error.message || `Request failed (${response.status})`, error.fields || {});
  }
  return payload || {};
}

async function requestData(method, path, options) {
  const payload = await request(method, path, options);
  return payload.data;
}

const seg = encodeURIComponent;

// ---------- Auth ----------
export const login = (username, password) => requestData('POST', '/api/auth/login', { body: { username, password } });
export const logout = () => requestData('POST', '/api/auth/logout');
export const getMe = () => requestData('GET', '/api/auth/me');

// ---------- Rooms (public) ----------
export async function listRooms(params) {
  const payload = await request('GET', '/api/rooms', { query: params });
  return { data: payload.data || [], meta: payload.meta || null };
}
export const getRoom = (roomId) => requestData('GET', `/api/rooms/${seg(roomId)}`);
export const getSimilarRooms = (roomId) => requestData('GET', `/api/rooms/${seg(roomId)}/similar`);
export const getStats = () => requestData('GET', '/api/stats');

// ---------- Rooms (admin) ----------
export const createRoom = (room) => requestData('POST', '/api/rooms', { body: room });
export const updateRoom = (roomId, room) => requestData('PUT', `/api/rooms/${seg(roomId)}`, { body: room });
export const deleteRoom = (roomId) => requestData('DELETE', `/api/rooms/${seg(roomId)}`);

export function uploadRoomImages(roomId, files) {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  return requestData('POST', `/api/rooms/${seg(roomId)}/images`, { formData });
}

export const deleteRoomImage = (roomId, imageId) =>
  requestData('DELETE', `/api/rooms/${seg(roomId)}/images/${seg(imageId)}`);

// ---------- Admin accounts (super_admin) ----------
export const listAdmins = (params) => requestData('GET', '/api/admins', { query: params });
export const getAdmin = (username) => requestData('GET', `/api/admins/${seg(username)}`);
export const createAdmin = (admin) => requestData('POST', '/api/admins', { body: admin });
export const updateAdmin = (username, admin) => requestData('PUT', `/api/admins/${seg(username)}`, { body: admin });
export const deleteAdmin = (username) => requestData('DELETE', `/api/admins/${seg(username)}`);
export const resetAdminPassword = (username, password) =>
  requestData('POST', `/api/admins/${seg(username)}/reset-password`, { body: { password } });

// ---------- Bookings ----------
export const createBooking = (booking) => requestData('POST', '/api/bookings', { body: booking });
