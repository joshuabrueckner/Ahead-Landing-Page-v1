
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

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function initializeFirebase() {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app);

  return {app, auth, firestore: db};
}

// Initialize immediately and export db
const { firestore } = initializeFirebase();
db = firestore;


export {
  initializeFirebase,
  db,
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
