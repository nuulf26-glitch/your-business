import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "../firebase";
import { clearCustomBackendSession, establishCustomBackendSession } from "./customBackendSession";

export async function register(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  await establishCustomBackendSession(result.user);
  return result;
}

export async function logout() {
  await clearCustomBackendSession();
  return await signOut(auth);
}
