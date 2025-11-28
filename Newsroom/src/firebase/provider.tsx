'use client';
import {createContext, useContext} from 'react';
import type {FirebaseApp} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import type {Firestore} from 'firebase/firestore';

import {UserProvider} from '@/firebase/auth/use-user';

type FirebaseContextValue = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({
  children,
  app,
  auth,
  firestore,
}: {
  children: React.ReactNode;
} & FirebaseContextValue) {
  return (
    <FirebaseContext.Provider value={{app, auth, firestore}}>
      <UserProvider>{children}</UserProvider>
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  return useContext(FirebaseContext);
};

export const useFirebaseApp = () => {
  const context = useContext(FirebaseContext);
  return context?.app;
};

export const useAuth = () => {
  const context = useContext(FirebaseContext);
  return context?.auth;
};

export const useFirestore = () => {
  const context = useContext(FirebaseContext);
  return context?.firestore;
};
