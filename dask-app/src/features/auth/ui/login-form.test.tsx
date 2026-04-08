import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/model/auth-provider";
import { AuthStore } from "@/features/auth/model/auth-store";
import { LoginForm } from "@/features/auth/ui/login-form";
import type { AuthServiceContract } from "@/features/auth/api/types";
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

describe("LoginForm accessibility and UX", () => {
  it("keeps browser autofill and password-manager attributes enabled", () => {
    const store = new AuthStore({
      authService: createAuthServiceMock(),
      transport: new MemoryTransport()
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider store={store}>
          <LoginForm />
        </AuthProvider>
      </MemoryRouter>
    );

    const normalizedHtml = html.toLowerCase();
    expect(normalizedHtml).toContain('autocomplete="username"');
    expect(normalizedHtml).toContain('autocomplete="current-password"');
    expect(normalizedHtml).toContain('name="email"');
    expect(normalizedHtml).toContain('name="password"');
    expect(normalizedHtml).not.toContain('autocomplete="off"');
    expect(normalizedHtml).not.toContain("onpaste");
  });
});
