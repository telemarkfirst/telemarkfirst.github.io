import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {useAuth} from './useAuth';
import {
  readLearnerProfile,
  writeLearnerProfile,
  type LearnerProfile,
} from './profile';

type ProfileStatus = 'signed-out' | 'loading' | 'absent' | 'ready' | 'error';

interface LearnerProfileContextValue {
  profile: LearnerProfile | null;
  status: ProfileStatus;
  error: string | null;
  refresh: () => Promise<void>;
  saveProfile: (profile: LearnerProfile) => Promise<LearnerProfile>;
}

const LearnerProfileContext = createContext<LearnerProfileContextValue | null>(null);

export function LearnerProfileProvider({children}: {children: ReactNode}): React.JSX.Element {
  const {user, loading: authLoading} = useAuth();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setStatus('signed-out');
      setError(null);
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const loaded = await readLearnerProfile(user);
      setProfile(loaded);
      setStatus(loaded ? 'ready' : 'absent');
    } catch (reason) {
      setProfile(null);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not load your learning path.');
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      return;
    }
    void refresh();
  }, [authLoading, refresh]);

  const saveProfile = useCallback(async (next: LearnerProfile) => {
    if (!user) throw new Error('Sign in before saving a learning path.');
    const saved = await writeLearnerProfile(user, next);
    setProfile(saved);
    setStatus('ready');
    setError(null);
    return saved;
  }, [user]);

  const value = useMemo(() => ({
    profile,
    status,
    error,
    refresh,
    saveProfile,
  }), [profile, status, error, refresh, saveProfile]);

  return (
    <LearnerProfileContext.Provider value={value}>
      {children}
    </LearnerProfileContext.Provider>
  );
}

export function useLearnerProfile(): LearnerProfileContextValue {
  const value = useContext(LearnerProfileContext);
  if (!value) throw new Error('useLearnerProfile must be used inside LearnerProfileProvider.');
  return value;
}
