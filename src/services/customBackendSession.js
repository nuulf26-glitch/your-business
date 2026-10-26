import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
const enabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');
const cachedUserKey = 'getcyb_session_user';

function readCachedUser() {
  if (!enabled || !sessionStorage.getItem('getcyb_session_token')) return null;
  try { return JSON.parse(sessionStorage.getItem(cachedUserKey) || 'null'); }
  catch { sessionStorage.removeItem(cachedUserKey); return null; }
}

function cacheUser(user) {
  if (enabled && user?.id) {
    const { id, uid, email, emailVerified, role, paid, trialActive, trialEndsAt } = user;
    sessionStorage.setItem(cachedUserKey, JSON.stringify({ id, uid: uid || id, email, emailVerified, role, paid, trialActive, trialEndsAt }));
  }
}
export const cacheAppUser = cacheUser;

export async function customBackendRequest(path, options = {}) {
  if (!baseUrl) throw new Error('Custom backend URL is not configured.');
  const sessionToken = sessionStorage.getItem('getcyb_session_token');
  let response;
  try {
    response = await fetch(`${baseUrl}/api/v1${path}`, {
      ...options,
      credentials: 'include',
      signal: options.signal || AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...(options.headers || {}) },
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('The custom backend took too long to respond. Check your connection and try again.');
    }
    throw error;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error=new Error(result.message || 'The request could not be completed.');error.status=response.status;throw error; }
  return result;
}

export async function establishCustomBackendSession(firebaseUser) {
  if (!enabled) return;
  const idToken = await firebaseUser.getIdToken(true);
  const result = await customBackendRequest('/auth/firebase-exchange', { method: 'POST', body: JSON.stringify({ idToken }) });
  if (result.accessToken) sessionStorage.setItem('getcyb_session_token', result.accessToken);
  cacheUser(result);
  return result;
}

export async function clearCustomBackendSession() {
  if (!enabled) return;
  if (baseUrl) await customBackendRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem('getcyb_session_token');
  sessionStorage.removeItem(cachedUserKey);
}
export const isCustomBackendSessionEnabled = () => enabled;

export async function getAppUser() {
  if (enabled) {
    if (!sessionStorage.getItem('getcyb_session_token')) {
      sessionStorage.removeItem(cachedUserKey);
      return null;
    }
    try {
      const account = await customBackendRequest('/auth/me');
      account.uid = account.id;
      cacheUser(account);
      return account;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        sessionStorage.removeItem('getcyb_session_token');
        sessionStorage.removeItem(cachedUserKey);
        return null;
      }
      return readCachedUser();
    }
  }
  return auth.currentUser;
}

export function subscribeAppUser(callback) {
  if (!enabled) return onAuthStateChanged(auth, callback);
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

