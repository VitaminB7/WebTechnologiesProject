// Search page. The URL query string is the single source of truth for filters + page,
// so reload / back / forward / shared links all reproduce the same results.
import { listRooms } from '../api.js';
import {
  clearFieldErrors, getQueryParams, renderFooter, renderPagination, renderPublicHeader,
  renderState, roomCard, setQueryParams, showApiError, toPositiveInt,
} from '../ui.js';

const FILTER_NAMES = ['type', 'floor', 'minCondition', 'minPrice', 'maxPrice', 'bedrooms'];

const form = document.getElementById('filter-form');
const results = document.getElementById('results');
const resultsCount = document.getElementById('results-count');
const pagination = document.getElementById('pagination');
let latestRequestId = 0;

function fillForm(params) {
  for (const name of FILTER_NAMES) form.elements[name].value = params[name] ?? '';
  form.elements.available.checked = params.available === 'true';
}

function readForm() {
  const filters = {};
  for (const name of FILTER_NAMES) {
    const value = form.elements[name].value.trim();
    if (value !== '') filters[name] = value;
  }
  if (form.elements.available.checked) filters.available = 'true';
  return filters;
}

function validate(filters) {
  const fields = {};
  const floor = toPositiveInt(filters.floor);
  if (filters.floor && (!floor || floor > 99)) fields.floor = 'Floor must be a whole number from 1 to 99';
  for (const name of ['minPrice', 'maxPrice']) {
    if (filters[name] && !(Number(filters[name]) >= 0)) fields[name] = 'Price must be 0 or more';
  }
  if (!fields.minPrice && !fields.maxPrice && filters.minPrice && filters.maxPrice
      && Number(filters.minPrice) > Number(filters.maxPrice)) {
    fields.maxPrice = 'Max price must not be lower than min price';
  }
  return fields;
}

function renderResults(rooms, meta) {
  resultsCount.textContent = meta ? `${meta.total} room(s) found` : `${rooms.length} room(s) found`;
  if (!rooms.length) {
    renderState(results, 'empty', 'Try widening the price range or clearing some filters.', 'No rooms match your search');
  } else {
    results.replaceChildren(...rooms.map(roomCard));
  }
  renderPagination(pagination, meta, goToPage);
}

async function runSearch() {
  const params = getQueryParams();
  fillForm(params);
  const filters = readForm();
  const fields = validate(filters);
  pagination.replaceChildren();
  resultsCount.textContent = '';

  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please fix the highlighted filters.', fields });
    renderState(results, 'empty', 'Fix the highlighted filters to see rooms.');
    return;
  }
  clearFieldErrors(form);

  const requestId = ++latestRequestId;
  results.setAttribute('aria-busy', 'true');
  renderState(results, 'loading', 'Loading rooms...');
  try {
    const { data, meta } = await listRooms({ ...filters, page: toPositiveInt(params.page) || 1 });
    if (requestId === latestRequestId) renderResults(data, meta);
  } catch (error) {
    if (requestId !== latestRequestId) return;
    renderState(results, 'error', error.message, 'Could not load rooms');
    if (error.fields && Object.keys(error.fields).length) showApiError(form, error);
  } finally {
    if (requestId === latestRequestId) results.setAttribute('aria-busy', 'false');
  }
}

function goToPage(page) {
  setQueryParams({ ...readForm(), page: page > 1 ? page : '' });
  runSearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const filters = readForm();
  const fields = validate(filters);
  if (Object.keys(fields).length) {
    showApiError(form, { message: 'Please fix the highlighted filters.', fields });
    return;
  }
  setQueryParams(filters);
  runSearch();
});

document.getElementById('clear-filters').addEventListener('click', () => {
  form.reset();
  setQueryParams({});
  runSearch();
});

window.addEventListener('popstate', runSearch);

renderPublicHeader('search');
renderFooter();
runSearch();
