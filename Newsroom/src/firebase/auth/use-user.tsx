'use client';
import {User, onAuthStateChanged, Auth} from 'firebase/auth';
import {useState, useEffect, createContext, useContext} from 'react';

import {useAuth} from '@/firebase/provider';

const UserContext = createContext<User | null>(null);

export function UserProvider({children}: {children: React.ReactNode}) {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!auth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export const useUser = () => {
  return useContext(UserContext);
};
