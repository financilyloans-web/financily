// ============================================================================
// Firebase (modular SDK) setup
// ============================================================================
// This module is the single source of truth for the Firebase app. Pages import
// `app`, `auth` (and optionally `initAnalytics`) from here instead of touching
// the compat `firebase.auth()` global.
//
// NOTE: the apiKey is public by design (it only identifies the project); real
// security is enforced by Firebase Security Rules / App Check, not this key.
// Before production: enable App Check (reCAPTCHA v3 / Play Integrity) on Auth
// and restrict Authorized domains in the Firebase Console — see README
// "Firebase security (web app)".
// ============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyC38LtZ7bVQA5g7pC0fTikKLcZnwbz4S2M',
  authDomain: 'financily-17141.firebaseapp.com',
  projectId: 'financily-17141',
  storageBucket: 'financily-17141.firebasestorage.app',
  messagingSenderId: '599492015378',
  appId: '1:599492015378:web:c82a146b68ef216bf5afcb',
  measurementId: 'G-JTZBRLN6PQ'
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Language used for verification/SMS (kept consistent with previous setup).
auth.languageCode = 'it';

// Analytics is optional (guarded so it is a on environments where it is
// unsupported, e.g. some SSR/headless contexts).
export async function initAnalytics() {
  return (await isSupported()) ? getAnalytics(app) : null;
}
