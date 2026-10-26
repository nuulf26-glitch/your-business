import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "../firebase";
import { cacheAppUser, clearCustomBackendSession, customBackendRequest, establishCustomBackendSession, isCustomBackendSessionEnabled, notifyAppUserChanged } from "./customBackendSession";

export async function register(email, password, profile = {}) {
  if (isCustomBackendSessionEnabled()) {
    const result = await customBackendRequest('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, ...profile }) });
    if (result.id) localStorage.setItem('getcyb_account_id', result.id);
    notifyAppUserChanged();
    return result;
  }
  await setPersistence(auth, browserLocalPersistence);
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email, password) {
  if (isCustomBackendSessionEnabled()) {
    try {
      const result = await customBackendRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (result.accessToken) sessionStorage.setItem('getcyb_session_token', result.accessToken);
      if (result.id) localStorage.setItem('getcyb_account_id', result.id);
      cacheAppUser(result);
      notifyAppUserChanged();
      return result;
    } catch (customError) {
      // Existing Firebase accounts can still sign in and receive a backend session
      // through the verified-token bridge during the migration period.
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await establishCustomBackendSession(result.user);
      return result;
    }
  }
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  await establishCustomBackendSession(result.user);
  return result;
}

export async function logout() {
  await clearCustomBackendSession();
  localStorage.removeItem('getcyb_account_id');
  notifyAppUserChanged();
  return await signOut(auth);
}
