import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyBfBHn1lGfomoQFAyrG-T9uj1qnSs-FfJ4',
  authDomain: 'telemark-e9159.firebaseapp.com',
  projectId: 'telemark-e9159',
  storageBucket: 'telemark-e9159.firebasestorage.app',
  messagingSenderId: '451051066006',
  appId: '1:451051066006:web:8b83a622b63a73c61c28b7',
  measurementId: 'G-VXW7YL7R06',
};

const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const provider = new GoogleAuthProvider();
