import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/http-client";
import { AuthStore } from "@/features/auth/model/auth-store";
import type { AuthServiceContract, AuthSuccessResponse, AuthTokenPair } from "@/features/auth/api/types";
import type { SessionTokenPair, SessionTransport } from "@/shared/lib/auth/session-transport";

class MemoryTransport implements SessionTransport {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public setTokens(tokens: SessionTokenPair): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  public clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

const mockUser = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z"
};

const tokenPair: AuthTokenPair = {
  accessToken: "access-token",
  refreshToken: "refresh-token"
};

function authSuccess(overrides: Partial<AuthSuccessResponse> = {}): AuthSuccessResponse {
  return {
    user: mockUser,
    ...tokenPair,
    ...overrides
  };
}

function createAuthServiceMock(): AuthServiceContract {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn()
  };
}

describe("AuthStore", () => {
  it("logs in successfully and stores session in memory", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    vi.mocked(service.login).mockResolvedValue(authSuccess());

    const store = new AuthStore({ authService: service, transport });

    await store.login({ email: "ana@example.com", password: "Strong passphrase 2026" });

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("authenticated");
    expect(snapshot.isAuthenticated).toBe(true);
    expect(snapshot.user?.email).toBe("ana@example.com");
    expect(transport.getAccessToken()).toBe("access-token");
    expect(transport.getRefreshToken()).toBe("refresh-token");
  });

  it("maps login failure to a safe user message", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    vi.mocked(service.login).mockRejectedValue(
      new ApiError({ status: 401, message: "Invalid credentials." })
    );

    const store = new AuthStore({ authService: service, transport });

    await expect(
      store.login({ email: "ana@example.com", password: "wrong-passphrase" })
    ).rejects.toBeInstanceOf(ApiError);

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("unauthenticated");
    expect(snapshot.errorMessage).toBe("Credenciais invalidas.");
    expect(transport.getAccessToken()).toBeNull();
    expect(transport.getRefreshToken()).toBeNull();
  });

  it("bootstraps an existing session by loading /me", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    transport.setTokens(tokenPair);
    vi.mocked(service.me).mockResolvedValue(mockUser);

    const store = new AuthStore({ authService: service, transport });
    await store.bootstrap();

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("authenticated");
    expect(snapshot.user?.id).toBe("user-1");
    expect(service.me).toHaveBeenCalledTimes(1);
  });

  it("refreshes automatically during bootstrap when /me returns 401", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    transport.setTokens(tokenPair);

    vi.mocked(service.me)
      .mockRejectedValueOnce(new ApiError({ status: 401, message: "expired token" }))
      .mockResolvedValueOnce(mockUser);
    vi.mocked(service.refresh).mockResolvedValue({
      accessToken: "fresh-access-token",
      refreshToken: "fresh-refresh-token"
    });

    const store = new AuthStore({ authService: service, transport });
    await store.bootstrap();

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("authenticated");
    expect(service.refresh).toHaveBeenCalledTimes(1);
    expect(service.me).toHaveBeenCalledTimes(2);
    expect(transport.getAccessToken()).toBe("fresh-access-token");
  });

  it("refreshes once when multiple concurrent refresh requests happen", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    transport.setTokens(tokenPair);

    let resolveRefresh: (value: AuthTokenPair) => void = () => {};
    const refreshPromise = new Promise<AuthTokenPair>(resolve => {
      resolveRefresh = value => resolve(value);
    });
    vi.mocked(service.refresh).mockReturnValue(refreshPromise);

    const store = new AuthStore({ authService: service, transport });

    const first = store.refreshAccessToken();
    const second = store.refreshAccessToken();

    resolveRefresh({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe("new-access-token");
    expect(secondResult).toBe("new-access-token");
    expect(service.refresh).toHaveBeenCalledTimes(1);
    expect(transport.getAccessToken()).toBe("new-access-token");
  });

  it("expires the session when refresh returns unauthorized", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    transport.setTokens(tokenPair);
    vi.mocked(service.refresh).mockRejectedValue(
      new ApiError({ status: 401, message: "Refresh token expired." })
    );

    const store = new AuthStore({ authService: service, transport });
    const refreshed = await store.refreshAccessToken();

    const snapshot = store.getSnapshot();
    expect(refreshed).toBeNull();
    expect(snapshot.status).toBe("session_expired");
    expect(snapshot.sessionNotice).toContain("sessao expirou");
    expect(transport.getAccessToken()).toBeNull();
    expect(transport.getRefreshToken()).toBeNull();
  });

  it("logs out and clears local session state", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    vi.mocked(service.login).mockResolvedValue(authSuccess());
    vi.mocked(service.logout).mockResolvedValue();

    const store = new AuthStore({ authService: service, transport });
    const statuses: string[] = [];
    const unsubscribe = store.subscribe(() => {
      statuses.push(store.getSnapshot().status);
    });

    await store.login({ email: "ana@example.com", password: "Strong passphrase 2026" });
    await store.logout();
    unsubscribe();

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("unauthenticated");
    expect(snapshot.user).toBeNull();
    expect(service.logout).toHaveBeenCalledWith({ refreshToken: "refresh-token" });
    expect(transport.getAccessToken()).toBeNull();
    expect(statuses).toContain("logout_in_progress");
  });

  it("logout-all revokes server sessions and clears browser memory", async () => {
    const service = createAuthServiceMock();
    const transport = new MemoryTransport();
    vi.mocked(service.login).mockResolvedValue(authSuccess());
    vi.mocked(service.logoutAll).mockResolvedValue();

    const store = new AuthStore({ authService: service, transport });
    await store.login({ email: "ana@example.com", password: "Strong passphrase 2026" });
    await store.logoutAll();

    const snapshot = store.getSnapshot();
    expect(service.logoutAll).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe("unauthenticated");
    expect(transport.getRefreshToken()).toBeNull();
  });
});
