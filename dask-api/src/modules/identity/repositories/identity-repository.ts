import type { MembershipRole, Organization, User } from '@prisma/client';

// ---------------------------------------------------------------------------
// Stored-token types (independent of Prisma generation state)
// ---------------------------------------------------------------------------

export type StoredRefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type StoredPasswordResetToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Account lockout result
// ---------------------------------------------------------------------------

export type LockoutState = {
  failureCount: number;
  lockedUntil: Date | null;
};

export type ExternalAuthProvider = 'GOOGLE' | 'MICROSOFT';

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface IdentityRepository {
  // ── User ──────────────────────────────────────────────────────────────────
  createUser(input: {
    email: string;
    name: string;
    passwordHash: string | null;
    passwordHashVersion: number;
  }): Promise<User>;

  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  findUserByExternalIdentity(input: {
    provider: ExternalAuthProvider;
    providerSubject: string;
    providerTenantId?: string | null;
  }): Promise<User | null>;
  linkExternalIdentity(input: {
    userId: string;
    provider: ExternalAuthProvider;
    providerSubject: string;
    providerTenantId?: string | null;
    emailAtProvider?: string | null;
    emailVerified?: boolean | null;
  }): Promise<void>;

  updateUserPassword(
    userId: string,
    input: { passwordHash: string; hashVersion: number }
  ): Promise<void>;

  // ── Account lockout (NIST §5.2.2) ────────────────────────────────────────
  /** Atomically increment the failure counter; compute and set lockedUntil. */
  incrementLoginFailures(userId: string, maxFailures: number): Promise<LockoutState>;
  /** Reset failure counter and clear lockedUntil on successful authentication. */
  resetLoginFailures(userId: string): Promise<void>;

  // ── Organisation ─────────────────────────────────────────────────────────
  createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization>;

  getUserRoles(userId: string): Promise<MembershipRole[]>;

  // ── Refresh tokens ────────────────────────────────────────────────────────
  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void>;

  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;

  /**
   * Atomically revoke the given token.
   * Returns true if the token was found AND was not already revoked.
   * Returns false if it was already revoked (reuse detection signal).
   */
  revokeRefreshToken(tokenHash: string): Promise<boolean>;

  /** Revoke all tokens belonging to a family (reuse-detection response). */
  revokeTokenFamily(familyId: string): Promise<void>;

  /** Revoke every active refresh token for the user (logout-all). */
  revokeAllUserRefreshTokens(userId: string): Promise<void>;

  // ── Password reset tokens ─────────────────────────────────────────────────
  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;

  findPasswordResetToken(tokenHash: string): Promise<StoredPasswordResetToken | null>;

  markPasswordResetTokenUsed(tokenHash: string): Promise<void>;

  /** Invalidate all pending reset tokens for a user (e.g., on password change). */
  revokeUserResetTokens(userId: string): Promise<void>;

  /** Count how many unexpired+unused reset tokens a user already has. */
  countActiveResetTokens(userId: string): Promise<number>;
}
