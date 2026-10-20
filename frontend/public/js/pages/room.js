import { getRoom, getSimilarRooms } from '../api.js';
import {
  availabilityBadge, bedroomText, formatPrice, getQueryParams, h, imagePlaceholder,
  renderFooter, renderPublicHeader, renderState, roomCard, sizeText,
} from '../ui.js';

const APPLIANCE_ICONS = {
  Sofa: '🛋️',
  'Water heater': '🚿',
  Fridge: '🧊',
  TV: '📺',
  HomePhone: '☎️',
  'Air conditioner': '❄️',
  Heater: '🔥',
  'Washing machine': '🧺',
  Microwave: '🍲',
  'Induction stove': '🍳',
};
const GALLERY_SLOTS = 4;
const ROOM_ID_PATTERN = /^L-\d{4}$/;

const stateBox = document.getElementById('room-state');
const roomView = document.getElementById('room');
const byId = (id) => document.getElementById(id);

function showNotFound() {
  document.title = 'Room not found · AURA Sukhumvit 36';
  renderState(stateBox, 'empty', 'This room does not exist or has been removed.', 'Room not found');
  stateBox.firstChild.append(h('a', { className: 'btn btn--primary', href: '/search.html', text: 'Browse available rooms' }));
}

function renderGallery(room) {
  const slots = [];
  for (let i = 0; i < GALLERY_SLOTS; i += 1) {
    slots.push(h('div', {}, [imagePlaceholder(`Room ${room.roomId} photo ${i + 1}`)]));
  }
  byId('gallery').replaceChildren(...slots);
}

function renderSummary(room) {
  byId('room-title').textContent = `Room ${room.roomId}`;
  byId('room-building').textContent = room.building;
  byId('room-facts').replaceChildren(
    h('li', { text: bedroomText(room.bedrooms) }),
    h('li', { text: sizeText(room.size) }),
    h('li', { text: room.roomType }),
  );
  byId('room-description').textContent = room.description || 'No description yet.';
}

function renderOwner(owner = {}) {
  const rows = [['Name', owner.name], ['Phone', owner.phone], ['Email', owner.email], ['LINE ID', owner.lineId]];
  byId('owner-card').replaceChildren(
    ...rows.map(([label, value]) => h('div', {}, [h('dt', { text: label }), h('dd', { text: value || '-' })])),
  );
}

/** Appliances arrive as `{ serialNumber, name }`; visitors only need the name. */
function renderAppliances(appliances = []) {
  const list = byId('appliances');
  if (!appliances.length) {
    list.replaceChildren(h('li', { className: 'muted', text: 'No appliances listed.' }));
    return;
  }
  list.replaceChildren(...appliances.map(({ name }) => h('li', {}, [
    h('span', { className: 'appliances__icon', text: APPLIANCE_ICONS[name] || '•', 'aria-hidden': 'true' }),
    h('span', { text: name }),
  ])));
}

function renderRentBox(room) {
  byId('room-price').textContent = formatPrice(room.price);
  byId('room-status').replaceChildren(availabilityBadge(room.available, 'Available now'));
  const lease = room.minimumLease;
  byId('room-lease').textContent = lease === null || lease === undefined
    ? 'Minimum lease –'
    : `Minimum lease ${lease} month${lease === 1 ? '' : 's'}`;
}

async function loadSimilar(roomId) {
  const container = byId('similar');
  renderState(container, 'loading', 'Loading similar rooms...');
  try {
    const rooms = await getSimilarRooms(roomId);
    if (rooms.length) container.replaceChildren(...rooms.map(roomCard));
    else renderState(container, 'empty', 'No similar rooms right now.');
  } catch (error) {
    renderState(container, 'error', error.message);
  }
}

async function loadRoom(roomId) {
  renderState(stateBox, 'loading', 'Loading room...');
  try {
    const room = await getRoom(roomId);
    document.title = `Room ${room.roomId} · AURA Sukhumvit 36`;
    renderGallery(room);
    renderSummary(room);
    renderOwner(room.owner);
    renderAppliances(room.appliances);
    renderRentBox(room);
    stateBox.replaceChildren();
    roomView.classList.remove('hidden');
    loadSimilar(room.roomId);
  } catch (error) {
    if (error.status === 404 || error.status === 400) showNotFound();
    else renderState(stateBox, 'error', error.message, 'Could not load this room');
  }
}

renderPublicHeader('search');
renderFooter();

const requestedId = (getQueryParams().id || '').trim();
if (ROOM_ID_PATTERN.test(requestedId)) loadRoom(requestedId);
else showNotFound();
