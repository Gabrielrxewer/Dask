import type {
  Prisma} from '@prisma/client';
import {
  MembershipRole,
  type Organization,
  type PrismaClient,
  type User
} from '@prisma/client';
import type {
  ExternalAuthProvider,
  IdentityRepository,
  LockoutState,
  StoredEmailVerificationToken,
  StoredPasswordResetToken,
  StoredRefreshToken
} from '@/modules/identity/repositories/identity-repository';

// Lockout thresholds: { afterFailures → lockDurationMs }
const LOCKOUT_SCHEDULE: [number, number][] = [
  [5, 15 * 60 * 1000],    // 5 failures  → locked 15 min
  [10, 60 * 60 * 1000],   // 10 failures → locked 1 h
  [20, 24 * 60 * 60 * 1000] // 20 failures → locked 24 h
];

function computeLockedUntil(failureCount: number): Date | null {
  for (let i = LOCKOUT_SCHEDULE.length - 1; i >= 0; i--) {
    const [threshold, durationMs] = LOCKOUT_SCHEDULE[i];
    if (failureCount >= threshold) {
      return new Date(Date.now() + durationMs);
    }
  }
  return null;
}

export class PrismaIdentityRepository implements IdentityRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  // ── User ──────────────────────────────────────────────────────────────────

  public createUser(input: {
    email: string;
    name: string;
    passwordHash: string | null;
    passwordHashVersion: number;
    preferences?: unknown;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...input,
        preferences: input.preferences as Prisma.InputJsonValue | undefined
      }
    });
  }

  public findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  public updateUserPreferences(userId: string, preferences: unknown): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferences: preferences as Prisma.InputJsonValue }
    });
  }

  public async findUserByExternalIdentity(input: {
    provider: ExternalAuthProvider;
    providerSubject: string;
    providerTenantId?: string | null;
  }): Promise<User | null> {
    const identity = await this.prisma.externalIdentity.findFirst({
      where: {
        provider: input.provider,
        providerSubject: input.providerSubject,
        providerTenantId: input.providerTenantId ?? null
      },
      include: { user: true }
    });

    return identity?.user ?? null;
  }

  public async linkExternalIdentity(input: {
    userId: string;
    provider: ExternalAuthProvider;
    providerSubject: string;
    providerTenantId?: string | null;
    emailAtProvider?: string | null;
    emailVerified?: boolean | null;
  }): Promise<void> {
    const providerTenantId = input.providerTenantId ?? null;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.externalIdentity.findFirst({
        where: {
          provider: input.provider,
          providerSubject: input.providerSubject,
          providerTenantId
        }
      });

      if (existing) {
        await tx.externalIdentity.update({
          where: { id: existing.id },
          data: {
            userId: input.userId,
            emailAtProvider: input.emailAtProvider ?? null,
            emailVerified: input.emailVerified ?? null
          }
        });
        return;
      }

      await tx.externalIdentity.create({
        data: {
          userId: input.userId,
          provider: input.provider,
          providerSubject: input.providerSubject,
          providerTenantId,
          emailAtProvider: input.emailAtProvider ?? null,
          emailVerified: input.emailVerified ?? null
        }
      });
    });
  }

  public async updateUserPassword(
    userId: string,
    input: { passwordHash: string; hashVersion: number }
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: input.passwordHash, passwordHashVersion: input.hashVersion }
    });
  }

  // ── Account lockout ───────────────────────────────────────────────────────

  /**
   * Atomically increment failure count and set lockedUntil based on thresholds.
   * Uses a transaction to avoid races between concurrent failed login attempts.
   */
  public async incrementLoginFailures(
    userId: string,
    _maxFailures: number
  ): Promise<LockoutState> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { loginFailureCount: { increment: 1 } },
        select: { loginFailureCount: true }
      });

      const newCount = updated.loginFailureCount;
      const lockedUntil = computeLockedUntil(newCount);

      if (lockedUntil !== null) {
        await tx.user.update({
          where: { id: userId },
          data: { lockedUntil }
        });
      }

      return { failureCount: newCount, lockedUntil };
    });
  }

  public async resetLoginFailures(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { loginFailureCount: 0, lockedUntil: null }
    });
  }

  // ── Organisation ─────────────────────────────────────────────────────────

  public async createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    settings?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<Organization> {
    const execute = async (tx: Prisma.TransactionClient): Promise<Organization> => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          settings: input.settings as Prisma.InputJsonValue | undefined
        }
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: input.ownerUserId,
          role: MembershipRole.OWNER
        }
      });

      return organization;
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public async getUserRoles(userId: string): Promise<MembershipRole[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      select: { role: true }
    });
    return memberships.map((m) => m.role);
  }

  public async getIsPlatformAdmin(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ is_platform_admin: boolean | null }>>`
      SELECT "isPlatformAdmin" AS is_platform_admin
      FROM "User"
      WHERE id = ${userId}
      LIMIT 1
    `;

    return rows[0]?.is_platform_admin === true;
  }

  // ── Refresh tokens ────────────────────────────────────────────────────────

  public async createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  public async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Atomically revoke the token only if it is still active (revokedAt IS NULL).
   * Returns true if revocation happened (token was valid).
   * Returns false if token was already revoked — signals potential reuse attack.
   *
   * Using updateMany with the revokedAt IS NULL constraint provides CAS
   * semantics under PostgreSQL READ COMMITTED: if two requests race, only one
   * will match the WHERE clause and receive a non-zero count.
   */
  public async revokeRefreshToken(tokenHash: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return result.count > 0;
  }

  public async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  public async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  // ── Password reset tokens ─────────────────────────────────────────────────

  public async createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.create({ data: input });
  }

  public async findPasswordResetToken(
    tokenHash: string
  ): Promise<StoredPasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  public async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() }
    });
  }

  public async revokeUserResetTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() }
    });
  }

  public async countActiveResetTokens(userId: string): Promise<number> {
    return this.prisma.passwordResetToken.count({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } }
    });
  }

  // ── Email verification tokens ─────────────────────────────────────────────

  public async createEmailVerificationToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.emailVerificationToken.create({ data: input });
  }

  public async findEmailVerificationToken(
    tokenHash: string
  ): Promise<StoredEmailVerificationToken | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  public async markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() }
    });
  }

  public async setEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true }
    });
  }
}
