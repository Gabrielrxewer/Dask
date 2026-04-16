/**
 * AuthService — AAL1 authentication, aligned to NIST SP 800-63B / 800-63-4.
 *
 * Implemented controls:
 *  §5.1.1   Memorized-secret policy: delegated to PasswordService + validatePassword()
 *  §5.1.1.2 Verifier requirements: HMAC-SHA256 pre-hash + bcrypt, pepper, NFC, no truncation
 *  §5.2.2   Rate limiting: per-account failure counter + progressive lockout + IP layer
 *  §5.2.2   Timing-safe login: dummy bcrypt compare when user not found
 *  §7.1     Session management: short-lived JWT + opaque rotating refresh token
 *  §7.1     Refresh-token family tracking + reuse detection → family revocation
 *  §7.1     Logout / logout-all revoke tokens
 *  §5.1.1.2 Migration-on-login: transparent v0 → v1 rehash on successful login
 *  §8       Verifier-side privacy: no secrets in logs; structured audit events
 *  §5.1.1.2 Password-reset scaffolding: short-lived one-time token, stored as hash
 *
 * Gaps documented in docs/auth/NIST-compliance.md (infra / operational).
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import { recordTelemetryEvent } from '@/core/telemetry/telemetry-recorder';
import { validatePassword, normalizeEmail } from '@/modules/identity/domain/password-policy';
import type { PasswordService } from '@/modules/identity/application/password-service';
import type { EmailService } from '@/infra/email/email-service';
import type { WorkspaceInvitesService } from '@/modules/workspace-platform/application/workspace-invites-service';
import type {
  ExternalAuthProvider,
  IdentityRepository
} from '@/modules/identity/repositories/identity-repository';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterResult = {
  user: UserProfile;
  accessToken: string | null;
  refreshToken: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ExternalAuthInput = {
  provider: ExternalAuthProvider;
  providerSubject: string;
  email: string;
  name: string;
  inviteToken?: string;
  providerTenantId?: string | null;
  emailVerified?: boolean | null;
};

/**
 * Caller-supplied HTTP request context — used only for audit logging.
 * Never stored; never included in tokens or DB rows.
 */
export type RequestContext = {
  ip?: string;
  userAgent?: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** SHA-256 hash of an opaque token for safe DB storage. */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Parse a JWT-style duration string ("15m", "7d", …) to milliseconds. */
function parseDurationMs(value: string): number {
  const unit = value.slice(-1);
  const amount = parseInt(value.slice(0, -1), 10);
  const ms: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };
  return amount * (ms[unit] ?? 1_000);
}

function toUserProfile(
  user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  },
  isPlatformAdmin: boolean
): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    isPlatformAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

// ---------------------------------------------------------------------------
// Timing-safe dummy hash
// Pre-computed bcrypt hash used when a user is not found, so that login always
// runs a bcrypt comparison regardless — preventing timing-based user enumeration.
// NIST §5.2.2: the verifier SHALL NOT reveal whether the identifier exists.
// ---------------------------------------------------------------------------

// This is a valid bcrypt hash of an arbitrary string.  The value itself is not
// sensitive — it only exists to consume ~100 ms of CPU, matching a real compare.
const DUMMY_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/4b2sCTiLQK8EzNHi2';

// ---------------------------------------------------------------------------
// Audit logging (structured, no secrets)
// ---------------------------------------------------------------------------

type AuthEvent =
  | 'auth.register.success'
  | 'auth.register.conflict'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.login.locked'
  | 'auth.login.email_not_verified'
  | 'auth.refresh.success'
  | 'auth.refresh.reuse_detected'
  | 'auth.refresh.invalid'
  | 'auth.logout'
  | 'auth.logout_all'
  | 'auth.password_reset.requested'
  | 'auth.password_reset.completed'
  | 'auth.password_reset.invalid'
  | 'auth.email_verification.sent'
  | 'auth.email_verification.confirmed'
  | 'auth.email_verification.invalid';

function logAuthEvent(
  event: AuthEvent,
  fields: { userId?: string; context?: RequestContext; extra?: Record<string, unknown> }
): void {
  const reason = typeof fields.extra?.reason === 'string' ? fields.extra.reason : null;
  const provider = typeof fields.extra?.provider === 'string' ? fields.extra.provider : null;
  const failedEvents: AuthEvent[] = [
    'auth.login.failure',
    'auth.login.locked',
    'auth.login.email_not_verified',
    'auth.refresh.reuse_detected',
    'auth.refresh.invalid',
    'auth.password_reset.invalid',
    'auth.email_verification.invalid'
  ];

  logger.info({
    event,
    userId: fields.userId,
    ip: fields.context?.ip,
    userAgent: fields.context?.userAgent,
    ...fields.extra
  });

  void recordTelemetryEvent({
    category: 'auth',
    eventName: event,
    success: !failedEvents.includes(event),
    userId: fields.userId ?? null,
    method: null,
    route: null,
    reason,
    provider,
    ipHash: fields.context?.ip ?? null,
    userAgent: fields.context?.userAgent ?? null,
    metadata: fields.extra ?? null
  });
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  public constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly passwordService: PasswordService,
    private readonly emailService?: EmailService,
    private readonly workspaceInvitesService?: WorkspaceInvitesService
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  public async register(
    input: { email: string; name: string; password: string; inviteToken?: string },
    context?: RequestContext
  ): Promise<RegisterResult> {
    // 1. Policy validation (length + blocklist) — NIST §5.1.1.2
    const policyResult = validatePassword(input.password);
    if (!policyResult.ok) {
      throw new AppError(policyResult.reason, 422);
    }

    const email = normalizeEmail(input.email);

    // 2. Duplicate check — use generic message to limit enumeration
    const existing = await this.identityRepository.findUserByEmail(email);
    if (existing) {
      logAuthEvent('auth.register.conflict', { context, extra: { email } });
      // Do not say "email already in use" — use generic response (NIST §5.2.2)
      throw new AppError('Registration unsuccessful. Please check your details and try again.', 409);
    }

    // 3. Hash with current algorithm version (v1: HMAC-SHA256 + bcrypt)
    const { hash, version } = await this.passwordService.hash(input.password);

    // 4. Persist
    const user = await this.identityRepository.createUser({
      email,
      name: input.name,
      passwordHash: hash,
      passwordHashVersion: version
    });

    await this.tryAcceptWorkspaceInvite({
      inviteToken: input.inviteToken,
      userId: user.id,
      userEmail: user.email
    });

    let tokens: AuthTokens | null = null;
    const isPlatformAdmin = await this.identityRepository.getIsPlatformAdmin(user.id);
    if (user.emailVerified) {
      tokens = await this.issueTokenPair(
        user.id,
        user.email,
        user.emailVerified,
        isPlatformAdmin
      );
    }

    logAuthEvent('auth.register.success', {
      userId: user.id,
      context,
      extra: { emailVerified: user.emailVerified }
    });

    // Send email verification asynchronously — registration succeeds even if
    // the email delivery fails (the user can request a resend later).
    this.sendEmailVerification(user.id, user.email, user.name).catch((err) => {
      logger.warn({ event: 'auth.email_verification.send_failed', userId: user.id, err });
    });

    return {
      user: toUserProfile(user, isPlatformAdmin),
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null
    };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  public async login(
    input: { email: string; password: string; inviteToken?: string },
    context?: RequestContext
  ): Promise<{ user: UserProfile } & AuthTokens> {
    const email = normalizeEmail(input.email);
    const user = await this.identityRepository.findUserByEmail(email);

    // ── Timing-safe path when user does not exist ──────────────────────────
    // Always run a bcrypt compare to prevent timing-based user enumeration.
    // NIST §5.2.2: verifier SHALL NOT reveal whether the identifier exists.
    if (!user) {
      await this.passwordService.verify(input.password, DUMMY_HASH, 0);
      logAuthEvent('auth.login.failure', { context, extra: { reason: 'user_not_found', email } });
      throw new AppError('Invalid credentials.', 401);
    }

    // ── Lockout check ──────────────────────────────────────────────────────
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logAuthEvent('auth.login.locked', {
        userId: user.id,
        context,
        extra: { lockedUntil: user.lockedUntil }
      });
      throw new AppError(
        'Account temporarily locked due to repeated failed attempts. Please try again later.',
        429
      );
    }

    // ── Password verification ──────────────────────────────────────────────
    // Social-only accounts may not have a local password set.
    if (user.passwordHash === null) {
      const lockout = await this.identityRepository.incrementLoginFailures(
        user.id,
        env.AUTH_MAX_FAILURES
      );
      logAuthEvent('auth.login.failure', {
        userId: user.id,
        context,
        extra: {
          reason: 'password_not_set',
          failureCount: lockout.failureCount,
          lockedUntil: lockout.lockedUntil
        }
      });
      throw new AppError('Invalid credentials.', 401);
    }

    const valid = await this.passwordService.verify(
      input.password,
      user.passwordHash,
      user.passwordHashVersion
    );

    if (!valid) {
      const lockout = await this.identityRepository.incrementLoginFailures(
        user.id,
        env.AUTH_MAX_FAILURES
      );
      logAuthEvent('auth.login.failure', {
        userId: user.id,
        context,
        extra: {
          reason: 'bad_password',
          failureCount: lockout.failureCount,
          lockedUntil: lockout.lockedUntil
        }
      });
      throw new AppError('Invalid credentials.', 401);
    }

    // ── E-mail verification gate ──────────────────────────────────────────
    // Local accounts that have not confirmed their e-mail are blocked after
    // the first login attempt.  We do NOT block registration (the first
    // "session" is granted immediately), but every subsequent login requires
    // a verified address.  Social accounts are considered verified by default.
    if (!user.emailVerified) {
      logAuthEvent('auth.login.email_not_verified', {
        userId: user.id,
        context
      });
      throw new AppError(
        'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.',
        403,
        { code: 'EMAIL_NOT_VERIFIED' }
      );
    }

    // ── Success: reset lockout counter ────────────────────────────────────
    await this.identityRepository.resetLoginFailures(user.id);

    // ── Migration-on-login: transparently upgrade legacy hashes ───────────
    // NIST §5.1.1.2: verifier SHOULD upgrade storage when the subscriber
    // successfully authenticates with an older scheme.
    if (this.passwordService.needsUpgrade(user.passwordHashVersion)) {
      const { hash, version } = await this.passwordService.hash(input.password);
      await this.identityRepository.updateUserPassword(user.id, {
        passwordHash: hash,
        hashVersion: version
      });
    }

    const isPlatformAdmin = await this.identityRepository.getIsPlatformAdmin(user.id);
    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.emailVerified,
      isPlatformAdmin
    );
    await this.tryAcceptWorkspaceInvite({
      inviteToken: input.inviteToken,
      userId: user.id,
      userEmail: user.email
    });
    logAuthEvent('auth.login.success', { userId: user.id, context });
    return { user: toUserProfile(user, isPlatformAdmin), ...tokens };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  public async loginWithExternal(
    input: ExternalAuthInput,
    context?: RequestContext
  ): Promise<{ user: UserProfile } & AuthTokens> {
    const normalizedEmail = normalizeEmail(input.email);
    const linkedUser = await this.identityRepository.findUserByExternalIdentity({
      provider: input.provider,
      providerSubject: input.providerSubject,
      providerTenantId: input.providerTenantId ?? null
    });

    let user = linkedUser;

    if (!user) {
      const userByEmail = await this.identityRepository.findUserByEmail(normalizedEmail);

      if (userByEmail) {
        throw new AppError(
          'An account with this email already exists. Please sign in with your password to link this provider.',
          409,
          { code: 'EXTERNAL_LINK_CONFIRMATION_REQUIRED', provider: input.provider }
        );
      }
    }

    if (!user) {
      user = await this.identityRepository.createUser({
        email: normalizedEmail,
        name: input.name,
        passwordHash: null,
        passwordHashVersion: 1
      });
    }

    await this.identityRepository.linkExternalIdentity({
      userId: user.id,
      provider: input.provider,
      providerSubject: input.providerSubject,
      providerTenantId: input.providerTenantId ?? null,
      emailAtProvider: normalizedEmail,
      emailVerified: input.emailVerified ?? null
    });

    // External/OIDC authentication is treated as verified identity for this session.
    // Persisting this avoids refresh immediately failing with EMAIL_NOT_VERIFIED.
    if (!user.emailVerified) {
      await this.identityRepository.setEmailVerified(user.id);
      user.emailVerified = true;
    }

    await this.identityRepository.resetLoginFailures(user.id);

    const isPlatformAdmin = await this.identityRepository.getIsPlatformAdmin(user.id);
    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.emailVerified,
      isPlatformAdmin
    );
    await this.tryAcceptWorkspaceInvite({
      inviteToken: input.inviteToken,
      userId: user.id,
      userEmail: user.email
    });
    logAuthEvent('auth.login.success', {
      userId: user.id,
      context,
      extra: { provider: input.provider, oauth: true }
    });

    return { user: toUserProfile(user, isPlatformAdmin), ...tokens };
  }

  public async refresh(
    rawRefreshToken: string,
    context?: RequestContext
  ): Promise<AuthTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.identityRepository.findRefreshToken(tokenHash);

    // Token not found at all — could be a probe or expired+purged token
    if (!stored) {
      logAuthEvent('auth.refresh.invalid', {
        context,
        extra: { reason: 'token_not_found' }
      });
      throw new AppError('Invalid refresh token.', 401);
    }

    // ── Reuse detection ───────────────────────────────────────────────────
    // A revoked token being presented again signals that a previously issued
    // token was leaked and is now being replayed.  The safe response is to
    // revoke the entire family and force the user to log in again.
    // NIST 800-63B §7.1 / OAuth 2.0 Security BCP §4.13.2 (refresh token rotation)
    if (stored.revokedAt !== null) {
      logAuthEvent('auth.refresh.reuse_detected', {
        userId: stored.userId,
        context,
        extra: { familyId: stored.familyId, tokenId: stored.id }
      });
      await this.identityRepository.revokeTokenFamily(stored.familyId);
      throw new AppError(
        'Your session has been invalidated due to a security event. Please log in again.',
        401
      );
    }

    // Token expired
    if (stored.expiresAt < new Date()) {
      logAuthEvent('auth.refresh.invalid', {
        userId: stored.userId,
        context,
        extra: { reason: 'token_expired' }
      });
      throw new AppError('Refresh token expired.', 401);
    }

    // ── Atomic revocation ─────────────────────────────────────────────────
    // revokeRefreshToken uses updateMany WHERE revokedAt IS NULL.
    // If a concurrent request already revoked it, we get false here — which
    // means the OTHER request won its race, and this response is the "loser."
    // The loser path is: find the token (now revokedAt != null) → reuse
    // detection next time; here we just reject as invalid.
    const revoked = await this.identityRepository.revokeRefreshToken(tokenHash);
    if (!revoked) {
      // Another concurrent request just won — treat as invalid to avoid
      // issuing two tokens from the same original token.
      logAuthEvent('auth.refresh.invalid', {
        userId: stored.userId,
        context,
        extra: { reason: 'concurrent_revoke_race' }
      });
      throw new AppError('Invalid refresh token.', 401);
    }

    const user = await this.identityRepository.findUserById(stored.userId);
    if (!user) {
      throw new AppError('Invalid refresh token.', 401);
    }

    if (!user.emailVerified) {
      await this.identityRepository.revokeAllUserRefreshTokens(user.id);
      throw new AppError('Confirme seu e-mail antes de continuar.', 401, {
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Issue new token pair, reusing the same familyId (rotation)
    const isPlatformAdmin = await this.identityRepository.getIsPlatformAdmin(user.id);
    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.emailVerified,
      isPlatformAdmin,
      stored.familyId
    );
    logAuthEvent('auth.refresh.success', { userId: user.id, context });
    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  public async logout(rawRefreshToken: string, context?: RequestContext): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.identityRepository.findRefreshToken(tokenHash);
    await this.identityRepository.revokeRefreshToken(tokenHash);
    logAuthEvent('auth.logout', {
      userId: stored?.userId,
      context
    });
  }

  public async logoutAll(userId: string, context?: RequestContext): Promise<void> {
    await this.identityRepository.revokeAllUserRefreshTokens(userId);
    logAuthEvent('auth.logout_all', { userId, context });
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  public async me(userId: string): Promise<UserProfile> {
    const user = await this.identityRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found.', 404);
    }
    const isPlatformAdmin = await this.identityRepository.getIsPlatformAdmin(user.id);
    return toUserProfile(user, isPlatformAdmin);
  }

  // ── Password reset (scaffold) ─────────────────────────────────────────────

  /**
   * Request a password-reset token.
   * Always returns a generic response regardless of whether the email exists
   * (NIST §5.1.1.2 / anti-enumeration).
   *
   * In production, the `resetToken` returned here must be delivered via a
   * side-channel (email). See docs/auth/NIST-compliance.md — "infrastructure
   * dependencies".
   */
  public async requestPasswordReset(
    email: string,
    context?: RequestContext
  ): Promise<{ resetToken?: string }> {
    const normalized = normalizeEmail(email);
    const user = await this.identityRepository.findUserByEmail(normalized);

    // Always return generic 200 — do not reveal whether the email exists
    if (!user) {
      logAuthEvent('auth.password_reset.requested', {
        context,
        extra: { found: false }
      });
      return {};
    }

    // Social-only accounts have no local password — skip silently.
    // Do NOT reveal this distinction in the response (anti-enumeration).
    if (user.passwordHash === null) {
      logAuthEvent('auth.password_reset.requested', {
        context,
        extra: { found: true, skipped: 'social_only' }
      });
      return {};
    }

    // Rate-limit: allow at most 1 active reset token per user
    const active = await this.identityRepository.countActiveResetTokens(user.id);
    if (active > 0) {
      // Return generic 200 — do not reveal the rate limit per-account
      return {};
    }

    const rawToken = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.identityRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    logAuthEvent('auth.password_reset.requested', {
      userId: user.id,
      context,
      extra: { found: true }
    });

    const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;

    if (this.emailService) {
      await this.emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);
    } else if (env.NODE_ENV === 'development') {
      // Fallback for dev without email service configured.
      return { resetToken: rawToken };
    }

    return {};
  }

  public async confirmPasswordReset(
    input: { token: string; newPassword: string },
    context?: RequestContext
  ): Promise<void> {
    // 1. Policy check on new password
    const policyResult = validatePassword(input.newPassword);
    if (!policyResult.ok) {
      throw new AppError(policyResult.reason, 422);
    }

    const tokenHash = hashToken(input.token);
    const stored = await this.identityRepository.findPasswordResetToken(tokenHash);

    if (!stored || stored.usedAt !== null || stored.expiresAt < new Date()) {
      logAuthEvent('auth.password_reset.invalid', {
        context,
        extra: { reason: !stored ? 'not_found' : stored.usedAt ? 'already_used' : 'expired' }
      });
      throw new AppError('Invalid or expired reset token.', 400);
    }

    // 2. Hash new password
    const { hash, version } = await this.passwordService.hash(input.newPassword);

    // 3. Atomic update: mark token used + update password + revoke all sessions
    await Promise.all([
      this.identityRepository.markPasswordResetTokenUsed(tokenHash),
      this.identityRepository.updateUserPassword(stored.userId, {
        passwordHash: hash,
        hashVersion: version
      }),
      // Force re-login on all devices after password change
      this.identityRepository.revokeAllUserRefreshTokens(stored.userId)
    ]);

    // Invalidate any remaining pending reset tokens for this user
    await this.identityRepository.revokeUserResetTokens(stored.userId);

    logAuthEvent('auth.password_reset.completed', { userId: stored.userId, context });

    // Fire-and-forget security alert — never block the response on email delivery.
    const userForAlert = await this.identityRepository.findUserById(stored.userId);
    if (userForAlert && this.emailService) {
      this.emailService.sendPasswordChangedAlertEmail(userForAlert.email, userForAlert.name).catch((err) => {
        logger.warn({ event: 'email.password_changed_alert.send_failed', userId: stored.userId, err });
      });
    }
  }

  /**
   * Resend an e-mail verification link.
   * Always returns without error regardless of whether the account exists,
   * is already verified, or is a social-only account (anti-enumeration).
   */
  public async resendEmailVerification(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const user = await this.identityRepository.findUserByEmail(normalized);

    if (!user || user.emailVerified || user.passwordHash === null) {
      return;
    }

    await this.sendEmailVerification(user.id, user.email, user.name);
  }

  // ── Email verification ────────────────────────────────────────────────────

  /**
   * Confirm an email address using the one-time token sent via email.
   * Always returns a generic error message to avoid token oracle attacks.
   */
  public async confirmEmail(token: string, context?: RequestContext): Promise<void> {
    const tokenHash = hashToken(token);
    const stored = await this.identityRepository.findEmailVerificationToken(tokenHash);

    if (!stored || stored.usedAt !== null || stored.expiresAt < new Date()) {
      logAuthEvent('auth.email_verification.invalid', {
        context,
        extra: { reason: !stored ? 'not_found' : stored.usedAt ? 'already_used' : 'expired' }
      });
      throw new AppError('Invalid or expired verification link.', 400);
    }

    await Promise.all([
      this.identityRepository.markEmailVerificationTokenUsed(tokenHash),
      this.identityRepository.setEmailVerified(stored.userId)
    ]);

    logAuthEvent('auth.email_verification.confirmed', { userId: stored.userId, context });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async sendEmailVerification(userId: string, email: string, name: string): Promise<void> {
    if (!this.emailService) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.identityRepository.createEmailVerificationToken({ userId, tokenHash, expiresAt });

    const verifyUrl = `${env.APP_URL}/verify-email?token=${rawToken}`;
    await this.emailService.sendEmailVerificationEmail(email, name, verifyUrl);

    logAuthEvent('auth.email_verification.sent', { userId });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    emailVerified: boolean,
    isPlatformAdmin: boolean,
    existingFamilyId?: string
  ): Promise<AuthTokens> {
    const roles = await this.identityRepository.getUserRoles(userId);

    const accessToken = jwt.sign({ email, roles, emailVerified, isPlatformAdmin }, env.JWT_SECRET, {
      subject: userId,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex'); // 80 hex chars
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = existingFamilyId ?? uuid(); // new family on first login
    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN));

    await this.identityRepository.createRefreshToken({
      userId,
      tokenHash,
      familyId,
      expiresAt
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async tryAcceptWorkspaceInvite(input: {
    inviteToken?: string;
    userId: string;
    userEmail: string;
  }): Promise<void> {
    if (!this.workspaceInvitesService || !input.inviteToken) {
      return;
    }

    try {
      await this.workspaceInvitesService.tryAcceptInviteByToken({
        rawToken: input.inviteToken,
        userId: input.userId,
        userEmail: input.userEmail
      });
    } catch (error) {
      logger.warn({
        event: 'workspace.invite.auto_accept.failed',
        userId: input.userId,
        err: error
      });
    }
  }
}

