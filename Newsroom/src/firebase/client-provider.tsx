'use client';
import {useState, useEffect} from 'react';
import type {FirebaseApp} from 'firebase/app';
import type {Auth} from 'firebase/auth';
import type {Firestore} from 'firebase/firestore';

import {initializeFirebase} from '@/firebase/index';
import {FirebaseProvider} from '@/firebase/provider';

export function FirebaseClientProvider({children}: {children: React.ReactNode}) {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  useEffect(() => {
    const {app, auth, firestore} = initializeFirebase();
    setFirebase({app, auth, firestore});
  }, []);

  if (!firebase) {
    return null;
  }

  return (
    <FirebaseProvider
      app={firebase.app}
      auth={firebase.auth}
      firestore={firebase.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
