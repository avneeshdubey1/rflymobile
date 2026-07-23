import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';

// Your web app's Firebase configuration
// These will be provided via Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if the config is present
let app;
let auth;
let authReady = Promise.resolve();

if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    auth.useDeviceLanguage(); // Set language for SMS matching device
    // Firebase verifies phone ownership only. The application's own HttpOnly
    // session cookie is authoritative, so do not persist a second identity on
    // a shared browser after the token exchange finishes.
    authReady = setPersistence(auth, inMemoryPersistence);
  } catch (err) {
    console.error('Firebase initialization error', err);
  }
} else {
  console.warn('Firebase config missing. OTP will not work.');
}

export { auth, authReady };
