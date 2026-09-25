import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDDJltPlA8kjDzWnYFNkQnRBxFylSH52Tg",
  authDomain: "gr-auto-adornos.firebaseapp.com",
  projectId: "gr-auto-adornos",
  storageBucket: "gr-auto-adornos.firebasestorage.app",
  messagingSenderId: "387692589652",
  appId: "1:387692589652:web:25cdeb4fcb183e00f133c1",
  measurementId: "G-XD4DMESRJ4"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
