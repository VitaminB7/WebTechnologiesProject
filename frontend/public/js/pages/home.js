import { getStats } from '../api.js';
import { renderFooter, renderPublicHeader } from '../ui.js';

async function loadStats() {
  const total = document.getElementById('stat-total-rooms');
  const types = document.getElementById('stat-room-types');
  const available = document.getElementById('stat-available');
  try {
    const stats = await getStats();
    total.textContent = String(stats.totalRooms);
    types.textContent = String(stats.roomTypes);
    available.textContent = `${stats.availableRooms} room(s) available right now.`;
  } catch (error) {
    total.textContent = '–';
    types.textContent = '–';
    available.textContent = `Could not load room statistics: ${error.message}`;
  }
}

renderPublicHeader('home');
renderFooter();
loadStats();
