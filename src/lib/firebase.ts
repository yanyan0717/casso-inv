import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC5sgVhlRCppy-w6r7LIxT6VwNmnJCCnew",
  authDomain: "casso-inv.firebaseapp.com",
  projectId: "casso-inv",
  storageBucket: "casso-inv.firebasestorage.app",
  messagingSenderId: "773504305853",
  appId: "1:773504305853:web:605873d55fa57039b2c5d4",
  measurementId: "G-FRHPFRKYEB",
  databaseURL: "https://casso-inv-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app);

// For User Management in AddUsers.tsx without logging out the current admin user
// We create a secondary app instance for admin operations
export const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const authSecondary = getAuth(secondaryApp);
export const secondaryAuth = authSecondary;

// Helper function to check if user is authenticated
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
};