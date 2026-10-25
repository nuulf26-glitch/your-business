import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "../firebase";
import { clearCustomBackendSession, customBackendRequest, establishCustomBackendSession, isCustomBackendSessionEnabled } from "./customBackendSession";

export async function register(email, password, profile = {}) {
  if (isCustomBackendSessionEnabled()) {
    return customBackendRequest('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, ...profile }) });
  }
  await setPersistence(auth, browserLocalPersistence);
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  if (isCustomBackendSessionEnabled()) {
    try {
      return await customBackendRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    } catch (customError) {
      // Existing Firebase accounts can still sign in and receive a backend session
      // through the verified-token bridge during the migration period.
      const result = await signInWithEmailAndPassword(auth, email, password);
      await establishCustomBackendSession(result.user);
      return result;
    }
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  await establishCustomBackendSession(result.user);
  return result;
}

export async function logout() {
  await clearCustomBackendSession();
  return await signOut(auth);
}
