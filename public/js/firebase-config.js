import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

export const firebaseConfig = {
  apiKey: "AIzaSyAlvZhLtXAb5jY-3pLlYmie6e9vNI2GavY",
  authDomain: "medios-santa-cruz.firebaseapp.com",
  projectId: "medios-santa-cruz",
  storageBucket: "medios-santa-cruz.firebasestorage.app",
  messagingSenderId: "101936062793",
  appId: "1:101936062793:web:8358b14a13d2da25a1ba98",
  measurementId: "G-DR7T9PNBC8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
