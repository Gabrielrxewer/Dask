import { appConfig } from "@/shared/config/env";

export interface SessionTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionTransport {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: SessionTokenPair) => void;
  clear: () => void;
}

class InMemorySessionTransport implements SessionTransport {
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

class CookieSessionTransport implements SessionTransport {
  public getAccessToken(): string | null {
    return null;
  }

  public getRefreshToken(): string | null {
    return null;
  }

  public setTokens(_tokens: SessionTokenPair): void {
    // Cookie mode keeps session secrets in HttpOnly cookies set by backend.
  }

  public clear(): void {
    // Cookie mode relies on backend session revocation; nothing stored in JS memory.
  }
}

export function createSessionTransport(): SessionTransport {
  if (appConfig.authTransportMode === "cookie-session") {
    return new CookieSessionTransport();
  }

  return new InMemorySessionTransport();
}
