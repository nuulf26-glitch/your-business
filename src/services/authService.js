import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "../firebase";

export async function register(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return await signOut(auth);
}