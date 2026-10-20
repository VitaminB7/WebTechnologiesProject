import { createBooking, getRoom } from '../api.js';
import {
  clearFieldErrors, formatDate, formatPrice, getQueryParams, h, renderFooter, renderPublicHeader,
  renderState, setBusy, showApiError, toPositiveInt, todayIso,
} from '../ui.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_NAMES = ['fullName', 'identityNumber', 'phone', 'email', 'moveInDate'];

const stateBox = document.getElementById('booking-state');
const card = document.getElementById('booking-card');
const form = document.getElementById('booking-form');
const submit = document.getElementById('booking-submit');
const confirmation = document.getElementById('booking-confirmation');

function readForm() {
  const values = {};
  for (const name of FIELD_NAMES) values[name] = form.elements[name].value.trim();
  return values;
}

/** Mirrors the API rules: all required, 13-digit ID, valid email, move-in not in the past. */
function validate(values) {
  const fields = {};
  if (!values.fullName) fields.fullName = 'Full name is required';
  if (!/^\d{13}$/.test(values.identityNumber)) fields.identityNumber = 'Identity number must be exactly 13 digits';
  const phoneDigits = values.phone.replace(/[\s-]/g, '');
  if (!/^\d{9,15}$/.test(phoneDigits)) fields.phone = 'Enter a valid phone number, e.g. 0801231234';
  if (!EMAIL_PATTERN.test(values.email)) fields.email = 'Enter a valid email address';
  if (!values.moveInDate) fields.moveInDate = 'Move-in date is required';
  else if (values.moveInDate < todayIso()) fields.moveInDate = 'Move-in date cannot be in the past';
  return fields;
}

function showConfirmation(booking, room) {
  card.classList.add('hidden');
  const rows = [
    ['Room', `Room ${room.roomId} (${room.roomType})`],
    ['Name', booking.fullName],
    ['Move-in date', formatDate(booking.moveInDate)],
    ['Status', booking.status],
  ];
  confirmation.replaceChildren(
    h('p', { className: 'eyebrow', text: 'Booking received' }),
    h('h1', { text: 'Thank you! Your booking request was sent.' }),
    h('p', { className: 'muted', text: 'Your booking ID' }),
    h('p', { className: 'confirmation__id', text: `#${booking.bookingId}` }),
    h('dl', {}, rows.flatMap(([label, value]) => [h('dt', { text: label }), h('dd', { text: value })])),
    h('div', { className: 'form-actions' }, [
      h('a', { className: 'btn btn--grey', href: `/room.html?id=${encodeURIComponent(room.roomId)}`, text: 'Back to room' }),
      h('a', { className: 'btn btn--primary', href: '/search.html', text: 'Browse more rooms' }),
    ]),
  );
  confirmation.classList.remove('hidden');
  confirmation.focus();
}

async function handleSubmit(event, room) {
  event.preventDefault();
  if (submit.disabled) return;
  const values = readForm();
  const fields = validate(values);
  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please check the highlighted fields.', fields });
    return;
  }

  clearFieldErrors(form);
  setBusy(submit, true, 'Booking...');
  try {
    const booking = await createBooking({ roomId: room.roomId, ...values });
    showConfirmation(booking, room);
  } catch (error) {
    setBusy(submit, false);
    showApiError(form, error);
  }
}

function showRoomForm(room) {
  document.getElementById('booking-room').replaceChildren(
    h('strong', { text: `Room ${room.roomId} · ${room.roomType} · Floor ${room.floor}` }),
    h('span', { text: `${formatPrice(room.price)} / month` }),
  );
  document.getElementById('booking-cancel').href = `/room.html?id=${encodeURIComponent(room.roomId)}`;
  form.elements.moveInDate.min = todayIso();
  form.addEventListener('submit', (event) => handleSubmit(event, room));
  stateBox.replaceChildren();
  card.classList.remove('hidden');
}

function showUnavailable(message, title, room) {
  renderState(stateBox, 'empty', message, title);
  const href = room ? `/room.html?id=${encodeURIComponent(room.roomId)}` : '/search.html';
  stateBox.firstChild.append(h('a', { className: 'btn btn--primary', href, text: room ? 'Back to room' : 'Browse rooms' }));
}

async function init(roomId) {
  if (!roomId) {
    showUnavailable('No room was selected for booking.', 'Room not found');
    return;
  }
  renderState(stateBox, 'loading', 'Loading room...');
  try {
    const room = await getRoom(roomId);
    if (room.available) showRoomForm(room);
    else showUnavailable(`Room ${room.roomId} is currently occupied and cannot be booked.`, 'Room not available', room);
  } catch (error) {
    if (error.status === 404 || error.status === 400) showUnavailable('This room does not exist or has been removed.', 'Room not found');
    else renderState(stateBox, 'error', error.message, 'Could not load this room');
  }
}

renderPublicHeader('search');
renderFooter();
init(toPositiveInt(getQueryParams().roomId));
