'use client';
import {useState, useEffect} from 'react';
import {
  collection,
  query,
  onSnapshot,
  Query,
  DocumentData,
} from 'firebase/firestore';

import {useFirestore} from '@/firebase/provider';

export function useCollection<T>(path: string) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) {
      return;
    }
    const collectionQuery: Query<DocumentData> = query(collection(firestore, path));
    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const result: T[] = [];
        snapshot.forEach((doc) => {
          result.push({id: doc.id, ...doc.data()} as T);
        });
        setData(result);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching collection:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, path]);

  return {data, loading};
}
