export interface SessionTokens {
  accessToken: string;
}

export interface SessionTransport {
  getAccessToken: () => string | null;
  setTokens: (tokens: SessionTokens) => void;
  clear: () => void;
}

class InMemorySessionTransport implements SessionTransport {
  private accessToken: string | null = null;

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setTokens(tokens: SessionTokens): void {
    this.accessToken = tokens.accessToken;
  }

  public clear(): void {
    this.accessToken = null;
  }
}

export function createSessionTransport(): SessionTransport {
  return new InMemorySessionTransport();
}
