
import {initializeApp, getApp, getApps, FirebaseApp} from 'firebase/app';
import {getAuth, Auth} from 'firebase/auth';
import {getFirestore, Firestore} from 'firebase/firestore';

import {firebaseConfig} from '@/firebase/config';
import {useCollection} from '@/firebase/firestore/use-collection';
import {useDoc} from '@/firebase/firestore/use-doc';
import {useUser} from '@/firebase/auth/use-user';
import {
  FirebaseProvider,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
} from '@/firebase/provider';
import { FirebaseClientProvider } from './client-provider';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function initializeFirebase() {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }

  // Avoid initializing Auth eagerly in server/build contexts.
  // Auth initialization can throw if client env vars aren't present at build time.
  if (!auth && typeof window !== 'undefined') {
    auth = getAuth(app);
  }

  if (!db) {
    db = getFirestore(app);
  }

  return { app, auth, firestore: db };
}

function getFirestoreDb(): Firestore {
  return initializeFirebase().firestore;
}

function getFirebaseAuth(): Auth {
  const { app } = initializeFirebase();
  // If called server-side, initialize Auth on-demand.
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}


export {
  initializeFirebase,
  getFirestoreDb,
  getFirebaseAuth,
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
};
