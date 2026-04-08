import { describe, expect, it } from "vitest";
import { resolveProtectedRoute, resolvePublicRoute } from "@/features/auth/model/route-guard";
import type { AuthSnapshot } from "@/features/auth/model/types";

function snapshot(overrides: Partial<AuthSnapshot>): AuthSnapshot {
  return {
    status: "unauthenticated",
    user: null,
    initialized: true,
    sessionNotice: null,
    errorMessage: null,
    isAuthenticated: false,
    ...overrides
  };
}

describe("route guards", () => {
  it("allows protected route when authenticated", () => {
    const result = resolveProtectedRoute(snapshot({ status: "authenticated", isAuthenticated: true }));
    expect(result).toEqual({ mode: "allow" });
  });

  it("redirects protected route when unauthenticated", () => {
    const result = resolveProtectedRoute(snapshot({ status: "unauthenticated" }));
    expect(result.mode).toBe("redirect");
    expect(result.redirectTo).toBe("/login");
    expect(result.reason).toBe("unauthenticated");
  });

  it("marks session expiration reason in protected redirect", () => {
    const result = resolveProtectedRoute(snapshot({ status: "session_expired" }));
    expect(result.mode).toBe("redirect");
    expect(result.reason).toBe("session_expired");
  });

  it("keeps public route for unauthenticated users", () => {
    const result = resolvePublicRoute(snapshot({ status: "unauthenticated" }));
    expect(result.mode).toBe("allow");
  });

  it("redirects authenticated users away from public login route", () => {
    const result = resolvePublicRoute(snapshot({ status: "authenticated", isAuthenticated: true }));
    expect(result.mode).toBe("redirect");
    expect(result.redirectTo).toBe("/board");
  });
});
