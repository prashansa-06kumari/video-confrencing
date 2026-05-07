import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfRuLaMA9Qn-zdhuGsd4MdeTau6ZACVbI",
  authDomain: "zvmeet.firebaseapp.com",
  projectId: "zvmeet",
  storageBucket: "zvmeet.firebasestorage.app",
  messagingSenderId: "654436649722",
  appId: "1:654436649722:web:65fd5bfede834ecc6bd743",
  measurementId: "G-W8DZQFH2RS"
};

const app = initializeApp(firebaseConfig);

const firestore = getFirestore(app);
const auth = getAuth(app);

export { app, auth, firestore };
