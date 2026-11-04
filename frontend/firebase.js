// ============================================================================
// Firebase client setup
// ============================================================================
// IMPORTANT — this file intentionally contains the Firebase "apiKey".
// This is NOT a credential/secret. Firebase web API keys are public by design:
// they only identify your Firebase project and are shipped in every client app.
// Real security is enforced by Firebase Security Rules and Firebase App Check —
// never by this key. (See https://firebase.google.com/docs/projects/api-keys)
// Therefore this value is safe to commit and load in the browser.
//
// This file is loaded AFTER the Firebase CDN scripts in index.html, which expose
// the global `firebase` object. Do not move it before those script tags.
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyC38LtZ7bVQA5g7pC0fTikKLcZnwbz4S2M",
  authDomain: "financily-17141.firebaseapp.com",
  projectId: "financily-17141",
  storageBucket: "financily-17141.firebasestorage.app",
  messagingSenderId: "599492015378",
  appId: "1:599492015378:web:c82a146b68ef216bf5afcb",
  measurementId: "G-JTZBRLN6PQ"
};

firebase.initializeApp(firebaseConfig);

// Firebase Auth handle. (Modular `import { getAuth }` requires a bundler; in
// this compat build the equivalent is `firebase.auth()`.)
const auth = firebase.auth();

// Language used for verification/SMS (set to Italian as specified).
auth.languageCode = 'it';

// Google Analytics is optional; guard in case the analytics script is removed.
if (typeof firebase.analytics === 'function') {
  firebase.analytics();
}
