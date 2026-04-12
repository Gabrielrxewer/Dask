import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode
} from "react";
import { setHttpAuthBridge } from "@/shared/api/http-client";
import { createAuthStore, type AuthStore } from "@/features/auth/model/auth-store";
import { useAuthBootstrap } from "@/features/auth/model/use-auth-bootstrap";
import type { LoginInput, RegisterInput } from "@/features/auth/api/types";
import type { AuthSnapshot } from "@/features/auth/model/types";

interface AuthContextValue extends AuthSnapshot {
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<string | null>;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  store?: AuthStore;
}

export function AuthProvider({ children, store: providedStore }: AuthProviderProps) {
  const storeRef = useRef<AuthStore | null>(providedStore ?? null);

  if (!storeRef.current) {
    storeRef.current = createAuthStore();
  }

  const store = storeRef.current;

  const snapshot = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
    store.getSnapshot.bind(store)
  );

  useEffect(() => {
    setHttpAuthBridge({
      getAccessToken: () => store.getAccessToken(),
      refreshAccessToken: () => store.refreshAccessToken(),
      handleUnauthorized: () => store.handleUnauthorized(),
      getCsrfToken: () => store.getCsrfToken()
    });

    return () => {
      setHttpAuthBridge(null);
    };
  }, [store]);

  useAuthBootstrap(store);

  const bootstrap = useCallback(() => store.bootstrap(), [store]);
  const login = useCallback((input: LoginInput) => store.login(input), [store]);
  const register = useCallback((input: RegisterInput) => store.register(input), [store]);
  const logout = useCallback(() => store.logout(), [store]);
  const logoutAll = useCallback(() => store.logoutAll(), [store]);
  const refresh = useCallback(() => store.refreshAccessToken(), [store]);
  const clearSessionNotice = useCallback(() => store.clearSessionNotice(), [store]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      bootstrap,
      login,
      register,
      logout,
      logoutAll,
      refresh,
      clearSessionNotice
    }),
    [snapshot, bootstrap, login, register, logout, logoutAll, refresh, clearSessionNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
