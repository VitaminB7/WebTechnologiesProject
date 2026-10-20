// Shared UI helpers. All API/user text reaches the DOM through textContent (via `h`); no HTML strings are built.
import { getMe, logout } from './api.js';

export const CONDITION_LABELS = { 1: 'แย่', 2: 'พอใช้', 3: 'สภาพดี', 4: 'ดีมาก', 5: 'ใหม่มาก' };
export const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite'];
export const APPLIANCES = [
  'Sofa', 'Water heater', 'Fridge', 'TV', 'HomePhone',
  'Air conditioner', 'Heater', 'Washing machine', 'Microwave', 'Induction stove',
];

// ---------- Text / formatting ----------
export function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return `฿${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function conditionText(rating) {
  const value = Number(rating);
  const label = CONDITION_LABELS[value] || '';
  return `${Number.isFinite(value) ? value.toFixed(1) : '-'}★ ${label}`.trim();
}

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------- Images ----------
/** Only same-origin upload paths are ever used as <img src>. */
export function safeImageSrc(path) {
  return typeof path === 'string' && path.startsWith('/uploads/') && !path.includes('..') ? path : null;
}

/** API image `{ imageId, url }` → `{ id, src }` with a vetted src. */
export function toImage(image) {
  return { id: image.imageId, src: safeImageSrc(image.url) };
}

// ---------- DOM ----------
/** Create an element. `text` is set via textContent; `on*` keys become listeners. */
export function h(tag, props = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

const placeholder = () => h('div', { className: 'img-placeholder', text: 'No image' });

/** <img> for `src`, or a grey placeholder when there is no src or the file fails to load. */
export function imageOrPlaceholder(src, alt) {
  if (!src) return placeholder();
  const img = h('img', { src, alt, loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(placeholder()), { once: true });
  return img;
}

export function bedroomText(bedrooms) {
  const count = Number(bedrooms);
  return count === 0 ? 'Studio' : `${count} bedroom${count === 1 ? '' : 's'}`;
}

export function availabilityBadge(available, availableText = 'Available') {
  return h('span', {
    className: `badge ${available ? 'badge--available' : 'badge--occupied'}`,
    text: available ? availableText : 'Occupied',
  });
}

/** Result card used by search and "similar rooms". */
export function roomCard(room) {
  const cover = room.images && room.images.length ? toImage(room.images[0]).src : null;
  return h('a', { className: 'card room-card', href: `/room.html?id=${encodeURIComponent(room.roomId)}` }, [
    h('div', { className: 'room-card__media' }, [
      imageOrPlaceholder(cover, `Room ${room.roomId}`),
      h('span', { className: 'room-card__fav', text: '♡', 'aria-hidden': 'true' }),
    ]),
    h('div', { className: 'room-card__body' }, [
      h('p', { className: 'room-card__title', text: `Room ${room.roomId}` }),
      h('p', { className: 'room-card__owner', text: room.owner ? room.owner.name : '' }),
      h('p', { className: 'room-card__price', text: `${formatPrice(room.price)} / month` }),
      h('p', { className: 'room-card__meta', text: `${bedroomText(room.bedrooms)} · ${room.size} m²` }),
    ]),
  ]);
}

/** Loading / empty / error message inside a container. */
export function renderState(container, type, message, title) {
  const role = type === 'error' ? 'alert' : 'status';
  container.replaceChildren(
    h('div', { className: `state state--${type}`, role }, [
      title ? h('p', { className: 'state__title', text: title }) : null,
      h('p', { text: message }),
    ]),
  );
}

export function setBusy(button, busy, busyLabel = 'Saving...') {
  if (busy) {
    if (button.dataset.label === undefined) button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label !== undefined) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
  button.disabled = busy;
}

export function showToast(message, type = 'info') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = h('div', { className: 'toast-region', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const toast = h('div', { className: `toast toast--${type}`, text: message });
  region.append(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------- Forms ----------
export function clearFieldErrors(form) {
  form.querySelectorAll('.field-error').forEach((node) => node.remove());
  form.querySelectorAll('.is-invalid').forEach((node) => {
    node.classList.remove('is-invalid');
    node.removeAttribute('aria-invalid');
  });
  const formError = form.querySelector('.form-error');
  if (formError) formError.classList.add('hidden');
}

/** Show `fields` (from API or client validation) next to inputs named after each key. */
export function showFieldErrors(form, fields = {}) {
  const unmatched = [];
  for (const [name, message] of Object.entries(fields)) {
    const inputs = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
    const wrapper = inputs[0] && inputs[0].closest('.field, fieldset');
    if (!wrapper) {
      unmatched.push(`${name}: ${message}`);
      continue;
    }
    inputs.forEach((input) => {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    });
    wrapper.append(h('p', { className: 'field-error', text: message }));
  }
  return unmatched;
}

export function showFormError(form, message) {
  const box = form.querySelector('.form-error');
  if (!box) return showToast(message, 'error');
  box.textContent = message;
  box.classList.remove('hidden');
}

/** Render an ApiError (or client errors) on a form: field messages + summary message. */
export function showApiError(form, error) {
  clearFieldErrors(form);
  const unmatched = showFieldErrors(form, error.fields);
  const summary = [error.message, ...unmatched].filter(Boolean).join(' — ');
  if (summary) showFormError(form, summary);
  const firstInvalid = form.querySelector('.is-invalid');
  if (firstInvalid) firstInvalid.focus();
}

// ---------- URL query ----------
export function getQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

export function setQueryParams(params, { replace = false } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  const url = window.location.pathname + (text ? `?${text}` : '');
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

/** Positive integer from a string, or null. */
export function toPositiveInt(value) {
  return /^\d+$/.test(String(value ?? '').trim()) && Number(value) > 0 ? Number(value) : null;
}

// ---------- Pagination ----------
export function renderPagination(container, meta, onPage) {
  container.replaceChildren();
  if (!meta || !meta.total) return;
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (totalPages <= 1) return;

  const page = Math.min(Math.max(1, meta.page), totalPages);
  const button = (label, target, extra = {}) =>
    h('button', { type: 'button', text: label, onclick: () => onPage(target), ...extra });

  container.append(button('‹ Prev', page - 1, { disabled: page === 1, 'aria-label': 'Previous page' }));
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const last = Math.min(totalPages, first + 4);
  for (let n = first; n <= last; n += 1) {
    container.append(button(String(n), n, { 'aria-current': n === page ? 'page' : null }));
  }
  container.append(button('Next ›', page + 1, { disabled: page === totalPages, 'aria-label': 'Next page' }));
}

/** "Showing 1-6 of 20 rooms" */
export function rangeText(meta, count, noun) {
  if (!meta || !meta.total) return `Showing 0 ${noun}`;
  const start = (meta.page - 1) * meta.pageSize + 1;
  return `Showing ${start}-${start + count - 1} of ${meta.total} ${noun}`;
}

// ---------- Header / footer ----------
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

function logoutButton(className) {
  const button = h('button', { type: 'button', className, text: 'Logout' });
  button.addEventListener('click', () => handleLogout(button));
  return button;
}

function brand(href, title, tagline) {
  return h('a', { className: 'brand', href }, [
    h('span', { className: 'brand__logo', text: 'N', 'aria-hidden': 'true' }),
    h('span', {}, [h('span', { className: 'brand__name', text: title }), h('span', { className: 'brand__tagline', text: tagline })]),
  ]);
}

function navLinks(links, active) {
  return h('nav', { className: 'site-nav', 'aria-label': 'Main' },
    links.map(([key, label, href]) =>
      h('a', { href, text: label, className: key === active ? 'is-active' : null, 'aria-current': key === active ? 'page' : null })));
}

const PUBLIC_LINKS = [
  ['home', 'Home', '/index.html'],
  ['search', 'Search', '/search.html'],
  ['team', 'Team', '/team.html'],
];

/** Public header. Shows Login, or Admin + Logout when the session is valid. */
export async function renderPublicHeader(active) {
  const actions = h('div', { className: 'header-actions' });
  document.getElementById('site-header').replaceChildren(
    h('div', { className: 'container site-header__inner' }, [
      brand('/index.html', 'AURA SUKHUMVIT 36', 'One residence. Better renting.'),
      navLinks(PUBLIC_LINKS, active),
      actions,
    ]),
  );
  try {
    await getMe();
    actions.append(h('a', { className: 'btn btn--outline btn--sm', href: '/admin/rooms.html', text: 'Admin' }), logoutButton('btn btn--dark btn--sm'));
  } catch {
    if (active !== 'login') actions.append(h('a', { className: 'btn btn--dark btn--sm', href: '/login.html', text: 'Login' }));
  }
}

const ADMIN_LINKS = [
  ['rooms', 'Product management', '/admin/rooms.html'],
  ['accounts', 'User management', '/admin/accounts.html'],
];

export function renderAdminHeader(active, admin) {
  const user = h('span', { className: 'admin-user', text: admin ? `${admin.displayName} (${admin.role})` : '' });
  document.getElementById('site-header').replaceChildren(
    h('div', { className: 'container site-header__inner' }, [
      brand('/admin/rooms.html', 'ADMIN PAGE', 'AURA Sukhumvit 36'),
      navLinks(ADMIN_LINKS, active),
      h('div', { className: 'header-actions' }, [user, logoutButton('btn btn--outline btn--sm')]),
    ]),
  );
}

export function renderFooter(variant = 'public') {
  const text = variant === 'admin' ? 'AURA CONDO' : 'AURA SUKHUMVIT 36';
  document.getElementById('site-footer').replaceChildren(
    h('div', { className: 'container' }, [
      h('strong', { text }),
      h('span', { text: ` · © ${new Date().getFullYear()} · One residence. Better renting.` }),
    ]),
  );
}
