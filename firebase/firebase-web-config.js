// Firebase client config for browser apps (safe to publish).
// Replace placeholders with values from Firebase Console > Project settings > Your apps > Web app.
// Do NOT use service-account/admin keys in browser code.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDA1soYGzIFjntBuv08hA9NXoSDNZ5pUrk",
  authDomain: "alyssa-c95c3.firebaseapp.com",
  projectId: "alyssa-c95c3",
  storageBucket: "alyssa-c95c3.firebasestorage.app",
  messagingSenderId: "659097207470",
  appId: "1:659097207470:web:5f3f64c86e49d55b8ce33f",
  measurementId: "G-ZYPQ6C3VTL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);