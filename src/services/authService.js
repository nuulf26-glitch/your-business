import { cacheAppUser, clearCustomBackendSession, customBackendRequest, notifyAppUserChanged } from './customBackendSession';

function acceptSession(user) {
  if (user?.id) localStorage.setItem('getcyb_account_id', user.id);
  cacheAppUser(user);
  notifyAppUserChanged();
  return user;
}

export async function register(email, password, profile = {}) {
  return acceptSession(await customBackendRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, ...profile }),
  }));
}

export async function login(email, password) {
  return acceptSession(await customBackendRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }));
}

export async function googleSignIn(idToken, acceptedTerms = false) {
  return acceptSession(await customBackendRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, acceptedTerms }),
  }));
}

export async function logout() {
  await clearCustomBackendSession();
  localStorage.removeItem('getcyb_account_id');
  notifyAppUserChanged();
}
