import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !firebaseUser.emailVerified) {
        setUser(null);
        setLoading(false);
        void signOut(auth);
        return;
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}
