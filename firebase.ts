import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    projectId: "deposito-inventory-f7a1b",
    appId: "1:221074983931:web:febc0346ec1d7dc9bed95e",
    storageBucket: "deposito-inventory-f7a1b.firebasestorage.app",
    apiKey: "AIzaSyCKXfqtER1968lTf-t4-PWxDWGmb--dXEA",
    authDomain: "deposito-inventory-f7a1b.firebaseapp.com",
    messagingSenderId: "221074983931",
    projectNumber: "221074983931"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Habilitar persistencia offline
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code == 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
    }
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
