import { appConfig } from "@/shared/config/env";
import { isApiError } from "@/shared/api/http-client";
import { createSessionTransport, type SessionTransport } from "@/shared/lib/auth/session-transport";
import { authService } from "@/features/auth/api/auth-service";
import type { AuthServiceContract, LoginInput, RegisterInput } from "@/features/auth/api/types";
import type { AuthSnapshot, AuthState } from "@/features/auth/model/types";

const SESSION_EXPIRED_NOTICE = "Sua sessao expirou. Faca login novamente para continuar.";

type AuthListener = () => void;

interface RefreshOptions {
  setRefreshingState: boolean;
}

export interface AuthStoreDependencies {
  authService: AuthServiceContract;
  transport: SessionTransport;
}

const initialState: AuthState = {
  status: "initializing",
  user: null,
  initialized: false,
  sessionNotice: null,
  errorMessage: null
};

export class AuthStore {
  private readonly authService: AuthServiceContract;
  private readonly transport: SessionTransport;
  private readonly listeners = new Set<AuthListener>();
  private state: AuthState = initialState;
  private snapshot: AuthSnapshot = {
    ...initialState,
    isAuthenticated: false
  };
  private bootstrapInFlight: Promise<void> | null = null;
  private refreshInFlight: Promise<string | null> | null = null;

  public constructor(deps: AuthStoreDependencies) {
    this.authService = deps.authService;
    this.transport = deps.transport;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): AuthSnapshot {
    return this.snapshot;
  }

  public async bootstrap(): Promise<void> {
    if (this.bootstrapInFlight) {
      return this.bootstrapInFlight;
    }

    this.setState(prev => ({
      ...prev,
      status: "initializing",
      initialized: false,
      errorMessage: null
    }));

    const run = this.performBootstrap().finally(() => {
      this.bootstrapInFlight = null;
    });

    this.bootstrapInFlight = run;
    return run;
  }

  public async register(input: RegisterInput): Promise<void> {
    this.setState(prev => ({
      ...prev,
      errorMessage: null
    }));

    const result = await this.authService.register(input);
    this.transport.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });

    this.setState(prev => ({
      ...prev,
      status: "authenticated",
      user: result.user,
      initialized: true,
      sessionNotice: null,
      errorMessage: null
    }));
  }

  public async login(input: LoginInput): Promise<void> {
    this.setState(prev => ({
      ...prev,
      errorMessage: null
    }));

    try {
      const result = await this.authService.login(input);
      this.transport.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });

      this.setState(prev => ({
        ...prev,
        status: "authenticated",
        user: result.user,
        initialized: true,
        sessionNotice: null,
        errorMessage: null
      }));
    } catch (error) {
      this.transport.clear();
      this.setState(prev => ({
        ...prev,
        status: "unauthenticated",
        user: null,
        initialized: true,
        errorMessage: this.mapLoginError(error)
      }));
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (this.state.status === "logout_in_progress") {
      return;
    }

    const refreshToken = this.transport.getRefreshToken();
    const shouldCallLogout =
      appConfig.authTransportMode === "cookie-session" || Boolean(refreshToken);

    this.setState(prev => ({
      ...prev,
      status: "logout_in_progress",
      errorMessage: null
    }));

    this.transport.clear();

    try {
      if (shouldCallLogout) {
        await this.authService.logout({ refreshToken: refreshToken ?? undefined });
      }
    } finally {
      this.setState(prev => ({
        ...prev,
        status: "unauthenticated",
        user: null,
        initialized: true,
        sessionNotice: null,
        errorMessage: null
      }));
    }
  }

  public async logoutAll(): Promise<void> {
    if (this.state.status === "logout_in_progress") {
      return;
    }

    this.setState(prev => ({
      ...prev,
      status: "logout_in_progress",
      errorMessage: null
    }));

    try {
      await this.authService.logoutAll();
    } finally {
      this.transport.clear();
      this.setState(prev => ({
        ...prev,
        status: "unauthenticated",
        user: null,
        initialized: true,
        sessionNotice: null,
        errorMessage: null
      }));
    }
  }

  public async refreshAccessToken(): Promise<string | null> {
    return this.refreshTokens({
      setRefreshingState: this.state.status === "authenticated"
    });
  }

  public handleUnauthorized(): void {
    this.expireSession();
  }

  public clearSessionNotice(): void {
    this.setState(prev => ({
      ...prev,
      status: prev.status === "session_expired" ? "unauthenticated" : prev.status,
      sessionNotice: null
    }));
  }

  public getAccessToken(): string | null {
    return this.transport.getAccessToken();
  }

  public getCsrfToken(): string | null {
    return null;
  }

  private async performBootstrap(): Promise<void> {
    const hasAccessToken = Boolean(this.transport.getAccessToken());
    const hasRefreshToken = Boolean(this.transport.getRefreshToken());

    if (!hasAccessToken && !hasRefreshToken) {
      this.setState(prev => ({
        ...prev,
        status: "unauthenticated",
        user: null,
        initialized: true
      }));
      return;
    }

    if (!hasAccessToken && hasRefreshToken) {
      const refreshedAccessToken = await this.refreshTokens({ setRefreshingState: false });
      if (!refreshedAccessToken) {
        return;
      }
    }

    try {
      const user = await this.authService.me();
      this.setState(prev => ({
        ...prev,
        status: "authenticated",
        user,
        initialized: true,
        sessionNotice: null,
        errorMessage: null
      }));
    } catch (error) {
      if (this.isUnauthorized(error)) {
        const refreshedAccessToken = await this.refreshTokens({ setRefreshingState: false });
        if (!refreshedAccessToken) {
          return;
        }

        try {
          const user = await this.authService.me();
          this.setState(prev => ({
            ...prev,
            status: "authenticated",
            user,
            initialized: true,
            sessionNotice: null,
            errorMessage: null
          }));
        } catch (retryError) {
          if (this.isUnauthorized(retryError)) {
            this.expireSession();
            return;
          }

          this.transport.clear();
          this.setState(prev => ({
            ...prev,
            status: "unauthenticated",
            user: null,
            initialized: true,
            errorMessage: "Nao foi possivel restaurar a sessao. Tente novamente."
          }));
        }

        return;
      }

      this.transport.clear();
      this.setState(prev => ({
        ...prev,
        status: "unauthenticated",
        user: null,
        initialized: true,
        errorMessage: "Nao foi possivel restaurar a sessao. Tente novamente."
      }));
    }
  }

  private async refreshTokens(options: RefreshOptions): Promise<string | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = this.transport.getRefreshToken();

    if (appConfig.authTransportMode !== "cookie-session" && !refreshToken) {
      this.expireSession();
      return null;
    }

    if (options.setRefreshingState) {
      this.setState(prev => ({
        ...prev,
        status: "refreshing",
        errorMessage: null
      }));
    }

    const run = this.authService
      .refresh({ refreshToken: refreshToken ?? undefined })
      .then(tokens => {
        this.transport.setTokens(tokens);

        if (options.setRefreshingState && this.state.user) {
          this.setState(prev => ({
            ...prev,
            status: "authenticated",
            initialized: true,
            errorMessage: null
          }));
        }

        return tokens.accessToken;
      })
      .catch(error => {
        if (this.isUnauthorized(error)) {
          this.expireSession();
          return null;
        }

        if (options.setRefreshingState && this.state.user) {
          this.setState(prev => ({
            ...prev,
            status: "authenticated"
          }));
        }

        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    this.refreshInFlight = run;
    return run;
  }

  private expireSession(): void {
    if (this.state.status === "logout_in_progress") {
      return;
    }

    this.transport.clear();
    this.setState(prev => ({
      ...prev,
      status: "session_expired",
      user: null,
      initialized: true,
      sessionNotice: SESSION_EXPIRED_NOTICE,
      errorMessage: null
    }));
  }

  private isUnauthorized(error: unknown): boolean {
    return isApiError(error) && error.status === 401;
  }

  private mapLoginError(error: unknown): string {
    if (!isApiError(error)) {
      return "Falha ao iniciar sessao. Tente novamente.";
    }

    if (error.status === 401) {
      return "Credenciais invalidas.";
    }

    if (error.status === 429) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }

    if (error.isNetworkError) {
      return "Nao foi possivel conectar ao servidor.";
    }

    return "Falha ao iniciar sessao. Tente novamente.";
  }

  private setState(updater: (prev: AuthState) => AuthState): void {
    this.state = updater(this.state);
    this.snapshot = {
      ...this.state,
      isAuthenticated: this.state.status === "authenticated"
    };
    this.listeners.forEach(listener => listener());
  }
}

export function createAuthStore(
  deps: Partial<AuthStoreDependencies> = {}
): AuthStore {
  return new AuthStore({
    authService: deps.authService ?? authService,
    transport: deps.transport ?? createSessionTransport()
  });
}
