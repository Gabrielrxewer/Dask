# Authentication — NIST SP 800-63B / 800-63-4 Compliance

> **Scope**: AAL1 (single-factor: memorized secret).  
> **Last updated**: 2026-04-07  
> **Stack**: Node.js · TypeScript · Prisma / PostgreSQL · bcryptjs · JWT

---

## Quick-reference: endpoints

| Endpoint | Method | Rate limit | Auth required |
|---|---|---|---|
| `/api/v1/auth/register` | POST | 10 / h per IP | — |
| `/api/v1/auth/login` | POST | 20 / 15 min per IP | — |
| `/api/v1/auth/refresh` | POST | 15 / min per IP | — |
| `/api/v1/auth/logout` | POST | — | — |
| `/api/v1/auth/logout-all` | POST | — | JWT |
| `/api/v1/auth/me` | GET | — | JWT |
| `/api/v1/auth/password-reset/request` | POST | 5 / h per IP | — |
| `/api/v1/auth/password-reset/confirm` | POST | 5 / h per IP | — |

---

## NIST SP 800-63B §5.1.1 — Memorized Secret Policy

| Requirement | Status | Evidence |
|---|---|---|
| Minimum 15 characters (single-factor) | ✅ ATENDE | `password-policy.ts:PASSWORD_MIN_LENGTH = 15`; enforced in DTO and service |
| Maximum ≥ 64 characters allowed | ✅ ATENDE | `PASSWORD_MAX_LENGTH = 128`; no truncation |
| NO composition rules (no forced upper/lower/digit/special) | ✅ ATENDE | DTO: `z.string().min(15).max(128)` — zero regex requirements |
| Accept all printable ASCII + space | ✅ ATENDE | No character class restrictions in DTO or service |
| Accept Unicode | ✅ ATENDE | Zod accepts any string; HMAC input is UTF-8 |
| NFC normalization before hashing | ✅ ATENDE | `normalizePassword()` in `password-policy.ts`; applied in `PasswordService.hash()` and `verify()` |
| Verify full password (no truncation) | ✅ ATENDE | HMAC-SHA256 pre-hash collapses any-length input to 44 base64 chars before bcrypt; bcrypt 72-byte limit never reached |
| Blocklist of common / compromised passwords | ✅ ATENDE | Static set + pattern regexes in `password-policy.ts:validatePassword()`; checked in `AuthService.register()` and `confirmPasswordReset()` |
| No forced periodic rotation | ✅ ATENDE | Not implemented; not planned |
| No password hints or security questions | ✅ ATENDE | Not implemented; not planned |
| Allow paste / autofill (no client-side block) | ✅ ATENDE | API imposes no such restriction; note in DTO comments |

---

## NIST SP 800-63B §5.1.1.2 — Verifier Requirements (password storage)

| Requirement | Status | Evidence |
|---|---|---|
| Memory-hard / computationally expensive hash | ✅ ATENDE | bcrypt with configurable rounds (default 12) |
| Per-password random salt | ✅ ATENDE | bcrypt generates per-hash salt internally |
| Hash versioning / algorithm agility | ✅ ATENDE | `passwordHashVersion` column in `User`; v0 = legacy bcrypt, v1 = HMAC+bcrypt |
| Cost factor documented and adjustable | ✅ ATENDE | `PasswordService(pepper, rounds)`; default 12, overridable for testing (4) |
| Keyed hashing / pepper separate from DB | ✅ ATENDE | `HASH_PEPPER` env var; applied via `HMAC-SHA256(pepper, NFC(password))` before bcrypt; never stored in DB |
| Migration-on-login for legacy hashes | ✅ ATENDE | `AuthService.login()`: if `passwordHashVersion < CURRENT`, re-hash and persist transparently |
| Never log password, hash, or salt | ✅ ATENDE | Auth events log only `userId`, `ip`, `userAgent`, event type, and non-sensitive metadata |

> **Pepper rotation procedure**: Set `HASH_PEPPER_NEXT` in env, deploy, let migration-on-login
> upgrade all hashes. Once `passwordHashVersion = 2` rows cover all active users, retire the old
> pepper. No big-bang migration needed.

---

## NIST SP 800-63B §5.2.2 — Rate Limiting / Throttling

| Requirement | Status | Evidence |
|---|---|---|
| Per-account failure counting | ✅ ATENDE | `loginFailureCount` column; `incrementLoginFailures()` atomically increments via Prisma transaction |
| Progressive lockout by account | ✅ ATENDE | Thresholds: 5 failures → 15 min; 10 → 1 h; 20 → 24 h. Computed in `PrismaIdentityRepository.incrementLoginFailures()` |
| Reset failure count on successful login | ✅ ATENDE | `resetLoginFailures()` called immediately after successful `bcrypt.compare` |
| IP-based rate limit (complementary) | ✅ ATENDE | `createRateLimiter()` applied on register (10/h), login (20/15m), refresh (15/m), reset (5/h) |
| Timing-safe response when user not found | ✅ ATENDE | `AuthService.login()` always calls `passwordService.verify(..., DUMMY_HASH, 0)` when user not found |
| Distributed rate limiting | ⚠️ GAP OPERACIONAL | In-memory store resets on restart and is not shared across horizontal replicas. See "Infrastructure dependencies" section. |

---

## NIST SP 800-63B §7.1 — Session / Token Management

| Requirement | Status | Evidence |
|---|---|---|
| Short-lived access token | ✅ ATENDE | JWT signed with `JWT_SECRET`, expires in `JWT_EXPIRES_IN` (default 15 min) |
| Opaque refresh token | ✅ ATENDE | `crypto.randomBytes(40).toString('hex')` — 80 hex chars, ~320 bits of entropy |
| Refresh token stored only as hash | ✅ ATENDE | `SHA-256(rawToken)` stored; raw token never persisted |
| One-time use / rotation on every refresh | ✅ ATENDE | `revokeRefreshToken()` before `createRefreshToken()` on every `/refresh` call |
| Refresh-token families (session lineage) | ✅ ATENDE | `familyId` column; login/register generates new UUID; rotation preserves same `familyId` |
| Reuse detection → family revocation | ✅ ATENDE | `revokeTokenFamily(familyId)` called when a revoked token is presented; logs `auth.refresh.reuse_detected` |
| Race-condition safety in concurrent refresh | ✅ ATENDE | `revokeRefreshToken` uses `updateMany WHERE revokedAt IS NULL`; CAS semantics under PG Read Committed; second concurrent call gets `count = 0` → rejected |
| Logout revokes current session | ✅ ATENDE | `revokeRefreshToken(tokenHash)` |
| Logout-all revokes all sessions | ✅ ATENDE | `revokeAllUserRefreshTokens(userId)` |
| Secure cookie for browser-based apps | ⚠️ GAP OPERACIONAL | API currently uses JSON body. See "Infrastructure dependencies". |
| CSRF protection (if cookies used) | ⚠️ N/A AGORA | Not applicable while refresh token is in JSON body. Required if cookie strategy is adopted. |

---

## NIST SP 800-63B §8 — Privacy / Enumeration Protection

| Requirement | Status | Evidence |
|---|---|---|
| Login: same message whether user exists or not | ✅ ATENDE | `"Invalid credentials."` for both paths |
| Register: generic message on email conflict | ✅ ATENDE | `"Registration unsuccessful. Please check your details and try again."` |
| Timing: login does not reveal user existence | ✅ ATENDE | Dummy hash comparison for missing user equalizes response time |
| Email normalization (lowercase + trim) | ✅ ATENDE | `normalizeEmail()` applied in register, login, and reset flows |
| Structured audit log (no secrets) | ✅ ATENDE | `logAuthEvent()` emits pino-structured events: type, userId, ip, userAgent |
| Logged events | ✅ ATENDE | `auth.register.*`, `auth.login.*`, `auth.refresh.*`, `auth.logout`, `auth.logout_all`, `auth.password_reset.*` |
| No password / token / hash in logs | ✅ ATENDE | Only non-sensitive metadata logged; enforced by code review |

---

## Password Reset

| Requirement | Status | Evidence |
|---|---|---|
| Random one-time token | ✅ ATENDE | `crypto.randomBytes(32).toString('hex')` — 256-bit entropy |
| Token stored as SHA-256 hash | ✅ ATENDE | `PasswordResetToken.tokenHash` is SHA-256(raw) |
| Short expiry (1 h) | ✅ ATENDE | `expiresAt = now + 3600s`; checked on confirm |
| Invalidated after use | ✅ ATENDE | `markPasswordResetTokenUsed()` sets `usedAt`; subsequent use rejected |
| All sessions revoked after password change | ✅ ATENDE | `revokeAllUserRefreshTokens()` in `confirmPasswordReset()` |
| Rate limited per account (max 1 active token) | ✅ ATENDE | `countActiveResetTokens()` check; skips creation if count > 0 |
| Rate limited per IP | ✅ ATENDE | `resetLimiter`: 5 / h per IP |
| Generic response (no enumeration) | ✅ ATENDE | Always returns same 200 regardless of email existence |
| No security questions | ✅ ATENDE | Not implemented; not planned |
| Email delivery of token | ⚠️ GAP OPERACIONAL | Token generation and storage are complete. Delivery via email is an infrastructure dependency (SMTP / transactional email service). In `NODE_ENV=development`, the raw token is returned in the response for testing. |

---

## Test Coverage

| Test area | File | Scenarios covered |
|---|---|---|
| Password policy — length | `auth-service.spec.ts` | Reject < 15, reject > 128 |
| Password policy — composition rules removed | `auth-service.spec.ts` | Accept all-lowercase passphrase |
| Password policy — spaces allowed | `auth-service.spec.ts` | Accept passphrase with spaces |
| Blocklist — static list | `auth-service.spec.ts` | Reject known common password |
| Blocklist — patterns | `auth-service.spec.ts` | Reject all-same-char, pure numeric, keyboard walks |
| Register — success | `auth-service.spec.ts` | Tokens returned, passwordHash not exposed |
| Register — email normalization | `auth-service.spec.ts` | Stores lowercase email |
| Register — hash version 1 | `auth-service.spec.ts` | `passwordHashVersion = 1` persisted |
| Register — duplicate email | `auth-service.spec.ts` | Generic error (no "already in use") |
| Login — success | `auth-service.spec.ts` | Tokens returned |
| Login — wrong password (same error as missing user) | `auth-service.spec.ts` | `"Invalid credentials."` |
| Login — missing user (timing-safe) | `auth-service.spec.ts` | `"Invalid credentials."` |
| Login — locked account | `auth-service.spec.ts` | 429 locked error |
| Login — failure counter incremented | `auth-service.spec.ts` | `incrementLoginFailures` called |
| Login — success resets counter | `auth-service.spec.ts` | `resetLoginFailures` called |
| Login — migration-on-login v0→v1 | `auth-service.spec.ts` | `updateUserPassword` called with version 1 |
| Refresh — valid rotation | `auth-service.spec.ts` | New tokens, familyId preserved |
| Refresh — expired token | `auth-service.spec.ts` | Rejected with expired error |
| Refresh — non-existent token | `auth-service.spec.ts` | Rejected |
| Refresh — reuse detection → family revocation | `auth-service.spec.ts` | `revokeTokenFamily` called |
| Refresh — concurrent race condition | `auth-service.spec.ts` | Second call rejected |
| Logout — single session | `auth-service.spec.ts` | `revokeRefreshToken` called |
| Logout-all — all sessions | `auth-service.spec.ts` | `revokeAllUserRefreshTokens` called |
| Me — returns safe profile | `auth-service.spec.ts` | No passwordHash, hashVersion, failureCount |
| Me — unknown user → 404 | `auth-service.spec.ts` | Thrown |
| Password reset — request (email exists) | `auth-service.spec.ts` | Token created |
| Password reset — request (email missing) | `auth-service.spec.ts` | Generic 200, no token created |
| Password reset — per-account rate limit | `auth-service.spec.ts` | Skips creation when active token exists |
| Password reset — confirm success | `auth-service.spec.ts` | Token marked used, password updated, sessions revoked |
| Password reset — expired token | `auth-service.spec.ts` | Rejected |
| Password reset — already-used token | `auth-service.spec.ts` | Rejected |
| Password reset — short new password | `auth-service.spec.ts` | Rejected by policy |
| PasswordService — hash/verify round-trip v1 | `auth-service.spec.ts` | Verifies correctly |
| PasswordService — Unicode no truncation | `auth-service.spec.ts` | 80-byte emoji password verified |
| PasswordService — NFC normalization | `auth-service.spec.ts` | NFD = NFC on verify |
| PasswordService — needsUpgrade v0/v1 | `auth-service.spec.ts` | Correct booleans |
| PasswordService — v0 legacy verify | `auth-service.spec.ts` | Plain bcrypt fallback works |

---

## Infrastructure Dependencies (gaps not solvable in code)

These items are documented honestly — they are **not claimed as met** until the
corresponding infrastructure is in place.

| Item | NIST Reference | What is needed |
|---|---|---|
| **TLS / HTTPS termination** | §4.2.2 — all authentication over authenticated protected channels | TLS configured at load balancer / reverse proxy (nginx, Caddy, ALB). The API has no TLS itself. |
| **Email delivery for password reset** | §5.1.2 — out-of-band delivery of credentials/tokens | SMTP relay or transactional email (SendGrid, SES, Postmark). Scaffolding is complete; `requestPasswordReset()` only stores the token and logs the event. |
| **Distributed / Redis-backed rate limiting** | §5.2.2 — effective defense against automated attacks | `createRateLimiter()` uses in-memory `Map`; counter resets on process restart and is not shared between replicas. For multi-instance deployments, replace with `ioredis`-backed store (e.g., `rate-limiter-flexible` with Redis). |
| **Secure cookie strategy (HttpOnly + Secure + SameSite)** | §7.1 — session secrets should use secure cookies for browser-based clients | Currently, refresh token is passed in the JSON body. For browser apps, migrate to `Set-Cookie: __Host-refresh=...; Secure; HttpOnly; SameSite=Strict; Path=/`. Requires CORS and CSRF review. |
| **CSRF protection** | §7.1 — if cookies used for session on mutable routes | Required only if cookie strategy is adopted. Implement synchronizer-token or `SameSite=Strict` + `Origin` header validation. |
| **HSM / TEE for pepper** | §5.1.1.2 — keyed hash with secret separate from data store | Currently `HASH_PEPPER` is an env var (better than nothing, but not HSM-level protection). For higher assurance, store pepper in AWS KMS, HashiCorp Vault, or Azure Key Vault. |
| **Have I Been Pwned (HIBP) integration** | §5.1.1.2 — check against compromised-credential databases | Current blocklist is a static set (~300 entries + patterns). For continuous coverage, add `POST https://api.pwnedpasswords.com/range/{prefix}` k-anonymity query in `validatePassword()`. Network call must be non-blocking on login (only on register/reset). |
| **Centralised observability / SIEM ingestion** | §8 — audit records | Auth events are emitted to pino stdout. Route to a log aggregation system (CloudWatch, Datadog, Splunk) and set up alerts for `auth.refresh.reuse_detected`, `auth.login.locked`, and high failure-rate anomalies. |
| **Automated DB pruning of expired tokens** | Operational hygiene | `RefreshToken.expiresAt` and `PasswordResetToken.expiresAt` rows are never deleted by the API. Add a Prisma cron/job (e.g., via the existing BullMQ workers) to `deleteMany({ expiresAt: { lt: now } })` periodically. |
| **Account deletion / GDPR data erasure** | Privacy | Cascade delete is configured (`onDelete: Cascade`) for tokens. Full user data erasure flow is not implemented. |

---

## Migration instructions

```bash
# 1. Add the new env vars to your .env
#    (see .env.example for descriptions)
echo "HASH_PEPPER=$(openssl rand -hex 32)" >> .env

# 2. Run the Prisma migration (adds new columns + models)
npx prisma migrate dev --name nist-aal1-auth

# 3. Regenerate the Prisma client
npx prisma generate

# 4. Run the test suite
npm run test

# 5. Deploy — existing users have passwordHashVersion=0 and will be
#    transparently re-hashed to version 1 on their next successful login.
#    No bulk re-hashing needed; no downtime required.
```

### Column defaults after migration

| Model | New column | Default | Meaning |
|---|---|---|---|
| `User` | `passwordHashVersion` | `0` | Legacy plain-bcrypt for existing users; `1` for new registrations |
| `User` | `loginFailureCount` | `0` | Clean slate — no lockout on migration |
| `User` | `lockedUntil` | `null` | No lockout |
| `RefreshToken` | `familyId` | required | All new tokens get a family UUID; old rows need backfill if present* |

> *If there are existing `RefreshToken` rows from before this migration, run:
> ```sql
> UPDATE "RefreshToken" SET "familyId" = gen_random_uuid()::text WHERE "familyId" IS NULL;
> ```
> (Only needed if rows exist; a fresh deployment has no rows to backfill.)

---

## Final AAL1 Checklist

### ✅ Atende

- [x] Minimum 15-character passwords (single-factor)
- [x] Maximum 128 characters; no truncation via HMAC pre-hash
- [x] No composition rules (no upper/lower/digit/special requirements)
- [x] Accept spaces and all printable characters
- [x] Unicode accepted; NFC normalization before hashing
- [x] Blocklist of common / compromised passwords (static + pattern-based)
- [x] No forced periodic rotation
- [x] No hints or security questions
- [x] Password paste and autofill not blocked
- [x] bcrypt with pepper (HMAC-SHA256 keyed hashing)
- [x] Per-password random salt (bcrypt internal)
- [x] Hash version stored; algorithm agility designed in
- [x] Migration-on-login for legacy hashes (v0 → v1)
- [x] Per-account failure counter with progressive lockout (5/10/20 failures)
- [x] Counter reset on successful authentication
- [x] IP-based rate limiting as complementary layer
- [x] Timing-safe login (dummy hash comparison when user not found)
- [x] Access token short-lived (15 min default)
- [x] Refresh token opaque, 80 hex chars (~320-bit entropy), stored as SHA-256 hash
- [x] Refresh token one-time use with rotation
- [x] Refresh token family tracking (familyId)
- [x] Reuse detection → full family revocation
- [x] Race-condition safety in concurrent refresh (CAS via SQL WHERE revokedAt IS NULL)
- [x] Logout revokes current session
- [x] Logout-all revokes all sessions
- [x] Password reset: random token, stored as hash, 1-h expiry, one-time use
- [x] Password reset: all sessions revoked after password change
- [x] Password reset: generic response (no enumeration of email existence)
- [x] Password reset: per-account rate limit (1 active token at a time)
- [x] Email normalization (lowercase + trim) on all auth flows
- [x] Structured audit log: all auth events with userId, IP, user-agent
- [x] No secrets (password, hash, pepper, token) in logs
- [x] `me` endpoint exposes only: id, email, name, createdAt, updatedAt

### ⚠️ Atende parcialmente

- [ ] **Blocklist coverage**: static set covers ~300 entries + patterns; does not match full HIBP database (infrastructure dependency)
- [ ] **In-memory rate limiting**: effective on single instance; not shared across replicas (infrastructure dependency)
- [ ] **Pepper storage**: env var is better than DB storage but not HSM-level isolation (infrastructure dependency)

### ❌ Não atende (infra / operação externa)

- [ ] **TLS**: not configured at API layer; must be terminated at reverse proxy
- [ ] **Email delivery for reset**: scaffolding complete; SMTP not wired
- [ ] **Cookie-based session for browser apps**: uses JSON body currently
- [ ] **CSRF protection**: required only if cookie strategy is adopted
- [ ] **Distributed rate limiting**: Redis-backed store not implemented
- [ ] **Centralised observability / alerting**: stdout logs only
- [ ] **Automated token/reset-row cleanup**: no scheduled job to purge expired DB rows
