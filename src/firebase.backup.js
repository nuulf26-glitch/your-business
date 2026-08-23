import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAzqRfIgRAtEGjTpEn6RJWz1crvvq832qk",
  authDomain: "your-business-47e44.firebaseapp.com",
  projectId: "your-business-47e44",
  storageBucket: "your-business-47e44.firebasestorage.app",
  messagingSenderId: "369460093680",
  appId: "1:369460093680:web:c02644293eee9fa9321835",
  measurementId: "G-RZXJKL01DS",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;