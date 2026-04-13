import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, AuthStore } from "@/features/auth";
import { LoginForm } from "@/features/auth/ui/login-form";
import type { AuthServiceContract } from "@/features/auth/api/types";
import type { SessionTokens, SessionTransport } from "@/shared/lib/auth/session-transport";

class MemoryTransport implements SessionTransport {
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

function createAuthServiceMock(): AuthServiceContract {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    me: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    resendVerificationEmail: vi.fn(),
    verifyEmail: vi.fn()
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

  it("renders register step with name and new-password autocomplete", () => {
    const store = new AuthStore({
      authService: createAuthServiceMock(),
      transport: new MemoryTransport()
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/?step=register"]}>
        <AuthProvider store={store}>
          <LoginForm />
        </AuthProvider>
      </MemoryRouter>
    );

    const normalizedHtml = html.toLowerCase();
    expect(normalizedHtml).toContain('name="name"');
    expect(normalizedHtml).toContain('autocomplete="name"');
    expect(normalizedHtml).toContain('autocomplete="new-password"');
    expect(normalizedHtml).not.toContain('autocomplete="current-password"');
    expect(normalizedHtml).toContain('aria-label="entrar com google"');
    expect(normalizedHtml).toContain('aria-label="entrar com microsoft"');
  });
});
