import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
const enabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');

export async function customBackendRequest(path, options = {}) {
  if (!baseUrl) throw new Error('Custom backend URL is not configured.');
  const sessionToken = sessionStorage.getItem('getcyb_session_token');
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error=new Error(result.message || 'The request could not be completed.');error.status=response.status;throw error; }
  return result;
}

export async function establishCustomBackendSession(firebaseUser) {
  if (!enabled) return;
  const idToken = await firebaseUser.getIdToken(true);
  const result = await customBackendRequest('/auth/firebase-exchange', { method: 'POST', body: JSON.stringify({ idToken }) });
  if (result.accessToken) sessionStorage.setItem('getcyb_session_token', result.accessToken);
  return result;
}

export async function clearCustomBackendSession() {
  if (!enabled || !baseUrl) return;
  await customBackendRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem('getcyb_session_token');
}
export const isCustomBackendSessionEnabled = () => enabled;

export async function getAppUser() {
  if (enabled) {
    try { const account = await customBackendRequest('/auth/me'); return { ...account, uid: account.id }; }
    catch { return null; }
  }
  return auth.currentUser;
}

export function subscribeAppUser(callback) {
  if (!enabled) return onAuthStateChanged(auth, callback);
  let active = true;
  const refresh = () => getAppUser().then((user) => { if (active) callback(user); });
  window.addEventListener('getcyb-auth-changed', refresh);
  refresh();
  return () => { active = false; window.removeEventListener('getcyb-auth-changed', refresh); };
}

export function notifyAppUserChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('getcyb-auth-changed'));
}

