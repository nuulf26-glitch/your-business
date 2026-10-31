const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');
const apiBase = `${baseUrl}/api/v1`;
const cachedUserKey = 'getcyb_session_user';

function readCachedUser() {
  try { return JSON.parse(sessionStorage.getItem(cachedUserKey) || 'null'); }
  catch { sessionStorage.removeItem(cachedUserKey); return null; }
}

function cacheUser(user) {
  if (!user?.id) return;
  const { id, uid, email, emailVerified, role, paid, trialActive, trialEndsAt } = user;
  sessionStorage.setItem(cachedUserKey, JSON.stringify({ id, uid: uid || id, email, emailVerified, role, paid, trialActive, trialEndsAt }));
}
export const cacheAppUser = cacheUser;

export async function customBackendRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      credentials: 'include',
      // Keep the browser open long enough for the API's 50s provider deadline,
      // with a small buffer for server response handling.
      signal: options.signal || AbortSignal.timeout(path.includes('/ai/') ? 55000 : 45000),
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The custom backend took too long to respond. Check your connection and try again.', { cause: error });
    throw new Error(error instanceof Error ? error.message : 'The custom backend could not be reached.', { cause: error });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const message = response.status === 401 || response.status === 403 ? (path.includes('/ai/') ? 'Your session expired. Sign in again, then retry the prompt shown here.' : 'Your session expired. Sign in again to continue editing.') : result.message || 'The request could not be completed.'; const error = new Error(message); error.status = response.status; throw error; }
  return result;
}

export async function clearCustomBackendSession() {
  if (readCachedUser()) await customBackendRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem(cachedUserKey);
}
export async function getAppUser() {
  try {
    const account = await customBackendRequest('/auth/me');
    account.uid = account.id;
    cacheUser(account);
    return account;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      sessionStorage.removeItem(cachedUserKey);
      return null;
    }
    return readCachedUser();
  }
}

export function subscribeAppUser(callback) {
  let active = true;
  const refresh = () => getAppUser().then((user) => { if (active) callback(user); });
  window.addEventListener('getcyb-auth-changed', refresh);
  const cachedUser = readCachedUser();
  if (cachedUser) callback(cachedUser);
  refresh();
  return () => { active = false; window.removeEventListener('getcyb-auth-changed', refresh); };
}

export function notifyAppUserChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('getcyb-auth-changed'));
}
