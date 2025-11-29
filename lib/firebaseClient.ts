import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

const getEnvValue = (key: string): string | undefined => {
  const sources: Record<string, string | undefined>[] = [];

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    sources.push(import.meta.env as Record<string, string | undefined>);
  }

  if (typeof process !== 'undefined' && process.env) {
    sources.push(process.env as Record<string, string | undefined>);
  }

  for (const envVars of sources) {
    const value = envVars[`VITE_${key}`] || envVars[`NEXT_PUBLIC_${key}`];
    if (value) {
      return value;
    }
  }

  return undefined;
};

const firebaseConfig: FirebaseOptions = {
  apiKey: getEnvValue('FIREBASE_API_KEY'),
  authDomain: getEnvValue('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvValue('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvValue('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvValue('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvValue('FIREBASE_APP_ID'),
};

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;

const hasValidConfig = (): boolean => {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
};

export const getFirestoreClient = (): Firestore | null => {
  if (firestore) return firestore;

  if (!hasValidConfig()) {
    console.warn('[firebase] Missing Firebase configuration. Skipping Firestore initialization.');
    return null;
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  return firestore;
};
