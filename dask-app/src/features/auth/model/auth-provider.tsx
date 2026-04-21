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
import { beginGlobalLoading, releaseInitialGlobalLoading } from "@/shared/lib/loading/global-loading";
import { createAuthStore, type AuthStore } from "@/features/auth/model/auth-store";
import { useAuthBootstrap } from "@/features/auth/model/use-auth-bootstrap";
import type { LoginInput, RegisterInput } from "@/features/auth/api/types";
import type { UpdateUserAvatarInput } from "@/features/auth/api/types";
import type { AuthenticatedUser } from "@/entities/user";
import type { AuthSnapshot } from "@/features/auth/model/types";

interface AuthContextValue extends AuthSnapshot {
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refresh: () => Promise<string | null>;
  clearSessionNotice: () => void;
  updateUserAvatar: (input: UpdateUserAvatarInput) => Promise<AuthenticatedUser>;
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

  useEffect(() => {
    if (!["initializing", "refreshing", "logout_in_progress"].includes(snapshot.status)) {
      return undefined;
    }

    const stopLoading = beginGlobalLoading({
      source: "auth",
      label:
        snapshot.status === "logout_in_progress"
          ? "Encerrando sessao com seguranca"
          : "Validando sua sessao"
    });

    return () => {
      stopLoading();
    };
  }, [snapshot.status]);

  useEffect(() => {
    if (!snapshot.initialized) {
      return;
    }

    releaseInitialGlobalLoading();
  }, [snapshot.initialized]);

  useAuthBootstrap(store);

  const bootstrap = useCallback(() => store.bootstrap(), [store]);
  const login = useCallback((input: LoginInput) => store.login(input), [store]);
  const register = useCallback((input: RegisterInput) => store.register(input), [store]);
  const logout = useCallback(() => store.logout(), [store]);
  const logoutAll = useCallback(() => store.logoutAll(), [store]);
  const refresh = useCallback(() => store.refreshAccessToken(), [store]);
  const clearSessionNotice = useCallback(() => store.clearSessionNotice(), [store]);
  const updateUserAvatar = useCallback((input: UpdateUserAvatarInput) => store.updateUserAvatar(input), [store]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      bootstrap,
      login,
      register,
      logout,
      logoutAll,
      refresh,
      clearSessionNotice,
      updateUserAvatar
    }),
    [snapshot, bootstrap, login, register, logout, logoutAll, refresh, clearSessionNotice, updateUserAvatar]
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
