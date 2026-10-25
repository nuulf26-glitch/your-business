const enabled = import.meta.env.VITE_ENABLE_CUSTOM_API_SESSION === 'true';
const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');

export async function customBackendRequest(path, options = {}) {
  if (!baseUrl) throw new Error('Custom backend URL is not configured.');
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const error=new Error(result.message || 'The request could not be completed.');error.status=response.status;throw error; }
  return result;
}

export async function establishCustomBackendSession(firebaseUser) {
  if (!enabled) return;
  const idToken = await firebaseUser.getIdToken(true);
  return customBackendRequest('/auth/firebase-exchange', { method: 'POST', body: JSON.stringify({ idToken }) });
}

export async function clearCustomBackendSession() {
  if (!enabled || !baseUrl) return;
  await customBackendRequest('/auth/logout', { method: 'POST' }).catch(() => {});
}
export const isCustomBackendSessionEnabled = () => enabled;

