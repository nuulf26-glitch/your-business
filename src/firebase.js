import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from "firebase/auth";

const productionConfig = {
  apiKey: "AIzaSyAzqRfIgRAtEGjTpEn6RJWz1crvvq832qk",
  authDomain: "your-business-47e44.firebaseapp.com",
  projectId: "your-business-47e44",
  storageBucket: "your-business-47e44.firebasestorage.app",
  messagingSenderId: "369460093680",
  appId: "1:369460093680:web:c02644293eee9fa9321835",
  measurementId: "G-RZXJKL01DS",
};

const env = import.meta.env;
export const usingEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true' || (env.DEV && env.VITE_USE_FIREBASE_EMULATORS !== 'false');
const projectId = env.VITE_FIREBASE_PROJECT_ID || (usingEmulators ? 'demo-getcyb' : productionConfig.projectId);
const firebaseConfig = {
  ...productionConfig,
  projectId,
  apiKey: env.VITE_FIREBASE_API_KEY || (usingEmulators ? 'demo-key' : productionConfig.apiKey),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  appId: env.VITE_FIREBASE_APP_ID || productionConfig.appId,
};
if (usingEmulators && !projectId.startsWith('demo-')) throw new Error('Use a demo- project ID for local emulators.');
const app = initializeApp(firebaseConfig);
if (!usingEmulators && env.VITE_FIREBASE_APPCHECK_SITE_KEY) initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(env.VITE_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true,
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1');
if (usingEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

export default app;