// Firebase Web config for browser scripts (safe to expose on frontend).
// Do not put Admin SDK/service-account credentials in this file.
(function setFirebaseWebConfig() {
  const config = {
    apiKey: "AIzaSyDA1soYGzIFjntBuv08hA9NXoSDNZ5pUrk",
    authDomain: "alyssa-c95c3.firebaseapp.com",
    projectId: "alyssa-c95c3",
    storageBucket: "alyssa-c95c3.firebasestorage.app",
    messagingSenderId: "659097207470",
    appId: "1:659097207470:web:5f3f64c86e49d55b8ce33f",
    measurementId: "G-ZYPQ6C3VTL"
  };

  window.EDGEFRAME_FIREBASE_CONFIG = config;
  // Extra aliases supported by app.js, useful if older code paths reference these.
  window.FIREBASE_WEB_CONFIG = config;
  window.FIREBASE_CONFIG = config;
})();
