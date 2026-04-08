# Browser Security Contract (Auth)

This document defines the backend-to-frontend contract for browser-first authentication.

## Session model

- Access token:
  - Returned in JSON body on `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`.
  - Intended to be stored in frontend memory only.
  - Sent as `Authorization: Bearer <accessToken>`.
- Refresh token:
  - Never returned in JSON.
  - Stored only in HttpOnly cookie (`__Host-session` in production, `dask-session` in development).

## Cookies

### Session cookie

- Name:
  - Production: `__Host-session`
  - Development: `dask-session`
- Flags:
  - `HttpOnly=true`
  - `Secure=true` in production
  - `SameSite` from `COOKIE_SAME_SITE`
  - `Path=/`
  - no `Domain` attribute

### CSRF cookie

- Name: `dask-csrf`
- Purpose: carries HMAC-signed CSRF token bound to refresh token.
- Flags:
  - `HttpOnly=false` (frontend must read it)
  - `Secure=true` in production
  - `SameSite=strict`
  - `Path=/`

## CSRF flow (signed double-submit)

1. Backend issues both cookies after login/register/refresh.
2. Frontend reads `dask-csrf` and sends it in `X-CSRF-Token`.
3. Backend validates:
   - allowlisted `Origin` (when present)
   - `Sec-Fetch-Site` cross-site hint
   - `X-CSRF-Token === HMAC(refreshTokenCookie, CSRF_SECRET)` with timing-safe compare
4. If validation fails, backend returns `403`.

CSRF guard is required for:

- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`

## CORS policy

- `CORS_ALLOWED_ORIGINS` must be explicit allowlist.
- Wildcard origin is not allowed.
- `credentials: true` is enabled for cookie transport.

## Cache policy for auth

Auth endpoints set:

- `Cache-Control: no-store`
- `Pragma: no-cache`

## Frontend integration requirements

- Do not persist refresh token in localStorage/sessionStorage.
- Store access token in memory only.
- Send `Authorization` header on protected endpoints.
- Send `X-CSRF-Token` for state-changing auth endpoints that use cookie session.

## Environment variables

Required:

- `CORS_ALLOWED_ORIGINS`
- `CSRF_SECRET`
- `COOKIE_SAME_SITE`

Also required for auth core:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRES_IN`
- `HASH_PEPPER`
