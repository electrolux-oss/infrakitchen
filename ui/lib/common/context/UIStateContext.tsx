import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from "react";

export interface LocalStorageContextType<T = any> {
  value: T;
  set: (updater: (prev: T) => T) => void;
  get: <K extends keyof T>(key: K) => T[K];
  setKey: <K extends keyof T>(key: K, value: T[K]) => void;
  removeKey: (key: string) => void;
  clear: () => void;
}

const LocalStorageContext = createContext<
  LocalStorageContextType<any> | undefined
>(undefined);

const STORAGE_KEY = "local_storage_store";

function loadStore<T = any>(): T {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : ({} as T);
  } catch {
    return {} as T;
  }
}

function saveStore<T = any>(state: T) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export const LocalStorageProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [value, setValue] = useState<any>(() => loadStore());

  useEffect(() => {
    saveStore(value);
  }, [value]);

  const set = useCallback((updater: (prev: any) => any) => {
    setValue((prev: any) => updater(prev));
  }, []);

  const get = useCallback(
    <K extends keyof any>(key: K) => value?.[key],
    [value],
  );

  const setKey = useCallback(<K extends keyof any>(key: K, v: any) => {
    setValue((prev: any) => ({ ...prev, [key]: v }));
  }, []);

  const removeKey = useCallback((key: string) => {
    setValue((prev: any) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setValue({});
  }, []);

  const contextValue = useMemo(
    () => ({ value, set, get, setKey, removeKey, clear }),
    [value, set, get, setKey, removeKey, clear],
  );

  return (
    <LocalStorageContext.Provider value={contextValue}>
      {children}
    </LocalStorageContext.Provider>
  );
};

// Hook for accessing the local storage store context
export function useLocalStorage<T = any>() {
  const ctx = useContext(
    LocalStorageContext as React.Context<
      LocalStorageContextType<T> | undefined
    >,
  );
  if (!ctx)
    throw new Error(
      "useLocalStorage must be used within a LocalStorageProvider",
    );
  return ctx;
}
