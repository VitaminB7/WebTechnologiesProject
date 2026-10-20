// Admin pages: make sure someone is logged in before rendering anything.
import { getMe } from './api.js';
import { renderState } from './ui.js';

/**
 * Resolves with the logged-in Admin. On 401 it redirects to the login page and resolves null,
 * so callers just `if (!admin) return;`. Other failures are shown in `container`.
 */
export async function requireAdmin(container) {
  try {
    return await getMe();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('/login.html');
    } else if (container) {
      renderState(container, 'error', error.message, 'Could not verify your session');
    }
    return null;
  }
}
