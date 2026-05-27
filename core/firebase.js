import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcgGJ_Cn2v8SIVDVE21tUC18xr7A6JdU0",
  authDomain: "foodie-3946c.firebaseapp.com",
  projectId: "foodie-3946c",
  storageBucket: "foodie-3946c.firebasestorage.app",
  messagingSenderId: "564716245257",
  appId: "1:564716245257:web:39a04e3ab04fe851b003d8"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);