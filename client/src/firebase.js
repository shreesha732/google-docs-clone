// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB6CubOF4b9D9Wi3blTLCJANV2jWJa6E6o",
  authDomain: "docs-clone-7ce5e.firebaseapp.com",
  projectId: "docs-clone-7ce5e",
  storageBucket: "docs-clone-7ce5e.appspot.com",
  messagingSenderId: "398334406472",
  appId: "1:398334406472:web:7749dae00dd3d71109cd7d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };
