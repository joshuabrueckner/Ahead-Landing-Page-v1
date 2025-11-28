'use client';
import {useState, useEffect} from 'react';
import {doc, onSnapshot, DocumentReference, DocumentData} from 'firebase/firestore';

import {useFirestore} from '@/firebase/provider';

export function useDoc<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) {
      return;
    }
    const docRef: DocumentReference<DocumentData> = doc(firestore, path);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({id: snapshot.id, ...snapshot.data()} as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching document:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, path]);

  return {data, loading};
}
