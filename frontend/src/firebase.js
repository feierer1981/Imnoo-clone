// Firebase-Konfiguration und Initialisierung
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDNSXOrfxdbnCr0gE9jhRXqNLB18EbcgGY",
  authDomain: "cnc-calc-9b89b.firebaseapp.com",
  projectId: "cnc-calc-9b89b",
  storageBucket: "cnc-calc-9b89b.firebasestorage.app",
  messagingSenderId: "865098860743",
  appId: "1:865098860743:web:9513ea48e44c1570f516e2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
