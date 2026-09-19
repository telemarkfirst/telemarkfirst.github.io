import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getTelemarkAccount,
  saveTelemarkAccount,
  type AccountRole,
  type TelemarkAccount,
} from './classroom';
import {useAuth} from './useAuth';

export type TelemarkAccountStatus =
  | 'signed-out'
  | 'loading'
  | 'absent'
  | 'ready'
  | 'error';

interface TelemarkAccountContextValue {
  account: TelemarkAccount | null;
  status: TelemarkAccountStatus;
  error: string | null;
  refresh: () => Promise<void>;
  saveAccount: (role: AccountRole, username: string) => Promise<TelemarkAccount>;
}

const TelemarkAccountContext = createContext<TelemarkAccountContextValue | null>(null);

export function TelemarkAccountProvider(
  {children}: {children: ReactNode},
): React.JSX.Element {
  const {user, loading: authLoading} = useAuth();
  const [account, setAccount] = useState<TelemarkAccount | null>(null);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [status, setStatus] = useState<TelemarkAccountStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!user) {
      setAccount(null);
      setLoadedUid(null);
      setStatus('signed-out');
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const loaded = await getTelemarkAccount();
      if (requestId !== requestIdRef.current) return;
      setAccount(loaded);
      setLoadedUid(user.uid);
      setStatus(loaded ? 'ready' : 'absent');
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setAccount(null);
      setLoadedUid(user.uid);
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'Could not load your Telemark account.');
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      return;
    }
    void refresh();
  }, [authLoading, refresh]);

  const saveAccount = useCallback(async (role: AccountRole, username: string) => {
    if (!user) throw new Error('Sign in before saving an account.');
    const saved = await saveTelemarkAccount(role, username);
    setAccount(saved);
    setLoadedUid(user.uid);
    setStatus('ready');
    setError(null);
    return saved;
  }, [user]);

  const currentAccount = user && loadedUid === user.uid ? account : null;
  const currentStatus: TelemarkAccountStatus = authLoading
    ? 'loading'
    : !user
      ? 'signed-out'
      : loadedUid === user.uid ? status : 'loading';

  const value = useMemo(() => ({
    account: currentAccount,
    status: currentStatus,
    error,
    refresh,
    saveAccount,
  }), [currentAccount, currentStatus, error, refresh, saveAccount]);

  return (
    <TelemarkAccountContext.Provider value={value}>
      {children}
    </TelemarkAccountContext.Provider>
  );
}

export function useTelemarkAccount(): TelemarkAccountContextValue {
  const value = useContext(TelemarkAccountContext);
  if (!value) {
    throw new Error('useTelemarkAccount must be used inside TelemarkAccountProvider.');
  }
  return value;
}
