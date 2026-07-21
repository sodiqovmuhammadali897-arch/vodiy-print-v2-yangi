import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "SIZNING_API_KEY",
  authDomain: "SIZNING_LOYIHA.firebaseapp.com",
  projectId: "SIZNING_LOYIHA_ID",
  storageBucket: "SIZNING_LOYIHA.appspot.com",
  messagingSenderId: "SIZNING_SENDER_ID",
  appId: "SIZNING_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
