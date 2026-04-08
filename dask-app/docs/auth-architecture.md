# Frontend Authentication Architecture

## Goals

- Centralize all auth logic in one cohesive layer.
- Keep browser session handling safe from day one.
- Avoid localStorage/sessionStorage for sensitive session secrets.
- Prepare migration path to cookie-based browser session + CSRF without rewriting the app.

## Current backend contract in use

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`

Current contract expects:

- `Authorization: Bearer <accessToken>` for protected endpoints.
- `refreshToken` in request body for `refresh` and `logout`.

## Folder structure

```txt
src/
|-- app/
|   |-- providers/
|       |-- auth-provider.tsx
|       |-- app-provider.tsx
|       |-- router-provider.tsx
|-- entities/
|   |-- user/
|-- features/
|   |-- auth/
|       |-- api/
|       |   |-- auth-service.ts
|       |   |-- types.ts
|       |-- model/
|       |   |-- auth-store.ts
|       |   |-- auth-provider.tsx
|       |   |-- route-guard.ts
|       |   |-- use-auth-bootstrap.ts
|       |   |-- use-auth-route-guard.ts
|       |   |-- use-login.ts
|       |   |-- use-logout.ts
|       |   |-- use-session-status.ts
|       |   |-- types.ts
|       |-- ui/
|           |-- login-form.tsx
|           |-- route-guards.tsx
|-- pages/
|   |-- login-page/
|-- shared/
|   |-- api/
|   |   |-- http-client.ts
|   |-- config/
|   |   |-- env.ts
|   |-- lib/
|       |-- auth/
|           |-- session-transport.ts
```

## Runtime flow

### 1. App startup (bootstrap)

1. `AuthProvider` boots `AuthStore`.
2. Store checks in-memory session transport.
3. If no tokens are present: state becomes `unauthenticated`.
4. If tokens exist: calls `/auth/me`.
5. If `/me` returns `401`, store tries one controlled refresh and retries `/me`.
6. On refresh failure with `401`: clears session and marks `session_expired`.

### 2. Login

1. Login form submits to `authService.login`.
2. Returned token pair is kept in memory only.
3. User profile enters global auth state.
4. App transitions to `authenticated`.

### 3. Protected API calls + refresh

1. `apiClient` injects bearer token from auth bridge.
2. If a protected request gets `401`, it asks `AuthStore` for refresh.
3. Refresh is deduplicated by mutex (`refreshInFlight`).
4. Original request is replayed once.
5. If replay fails again with `401`, no loop is allowed.

### 4. Logout / logout-all

- `logout`: clears local session immediately, calls backend revoke endpoint when possible.
- `logout-all`: calls backend revoke-all, then clears local session.
- Both end in `unauthenticated`.

### 5. Route guards

- `ProtectedRoute`: allows only authenticated state.
- `PublicRoute`: keeps login public and redirects authenticated users away from login.
- Both show a safe auth-loading fallback while state is `initializing` or `refreshing`.

## Security decisions

- Sensitive tokens are not persisted in `localStorage`.
- Session secrets stay in JS memory only in current transport mode.
- No token logging in auth or HTTP layers.
- Refresh token handling is isolated in one store and one transport.
- Concurrent refresh calls are deduplicated.
- 401 retry happens only once per request (loop prevention).
- Session is wiped on refresh failure / expiration.
- Login UX keeps:
  - `autocomplete="username"`
  - `autocomplete="current-password"`
  - no paste blocking
  - no `autocomplete="off"` anti-patterns

## Browser model readiness

The app is prepared for stronger browser session transport:

- `VITE_AUTH_TRANSPORT_MODE` supports `body-refresh-token` (current) and `cookie-session` (prepared).
- `apiClient` already supports CSRF header injection hook.
- Session transport is abstracted (`shared/lib/auth/session-transport.ts`) to swap strategy without touching routes/pages.

## Gaps that depend on backend/HTTP contract

To reach the strongest browser model (HttpOnly cookie + CSRF):

1. Backend must issue refresh/session cookie as `Secure + HttpOnly + SameSite`.
2. `POST /auth/refresh` and `POST /auth/logout` must work with cookie transport (not body token).
3. Backend must issue and validate CSRF token for state-changing requests.
4. CORS must be hardened for credentialed requests (`Access-Control-Allow-Credentials`, explicit origin allowlist).
5. Session cookie domain/path/lifetime policies must be defined for production.
6. Optional: migrate away from JS-readable bearer token entirely (BFF/cookie-only session strategy).

Until those backend changes land, this frontend uses the safest practical option for current contract:

- access and refresh tokens in memory only
- no persistent storage for sensitive session secrets
- aggressive cleanup on logout/expiration
