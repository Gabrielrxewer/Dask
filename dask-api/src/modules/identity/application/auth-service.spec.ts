/**
 * AuthService unit tests — NIST SP 800-63B / 800-63-4 coverage
 *
 * Strategy: all IdentityRepository interactions are stubbed with vi.fn() so
 * tests are fast and deterministic.  PasswordService is instantiated with a
 * real pepper and low bcrypt rounds (4) to keep the suite under 30s.
 */

import { describe, it, expect, vi, beforeEach, type Mocked, type MockedFunction } from 'vitest';
import { AuthService } from '@/modules/identity/application/auth-service';
import { PasswordService } from '@/modules/identity/application/password-service';
import type {
  IdentityRepository,
  LockoutState,
  StoredPasswordResetToken,
  StoredRefreshToken
} from '@/modules/identity/repositories/identity-repository';
import type { MembershipRole, User } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PEPPER = 'test-pepper-exactly-32-characters!!';
const LOW_ROUNDS = 4; // fast for tests

function makePasswordService(): PasswordService {
  return new PasswordService(TEST_PEPPER, LOW_ROUNDS);
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    passwordHash: '',
    passwordHashVersion: 1,
    loginFailureCount: 0,
    lockedUntil: null,
    preferences: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  } as User;
}

function makeRefreshToken(overrides: Partial<StoredRefreshToken> = {}): StoredRefreshToken {
  return {
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: 'hashed-token',
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides
  };
}

function makeRepo(): Mocked<IdentityRepository> {
  return {
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    findUserByExternalIdentity: vi.fn(),
    linkExternalIdentity: vi.fn(),
    updateUserPassword: vi.fn(),
    incrementLoginFailures: vi.fn(),
    resetLoginFailures: vi.fn(),
    createOrganization: vi.fn(),
    getUserRoles: vi.fn().mockResolvedValue([] as MembershipRole[]),
    createRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeTokenFamily: vi.fn(),
    revokeAllUserRefreshTokens: vi.fn(),
    createPasswordResetToken: vi.fn(),
    findPasswordResetToken: vi.fn(),
    markPasswordResetTokenUsed: vi.fn(),
    revokeUserResetTokens: vi.fn(),
    countActiveResetTokens: vi.fn()
  } as unknown as Mocked<IdentityRepository>;
}

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

describe('validatePassword (policy, blocklist, patterns)', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('rejects passwords shorter than 15 characters', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: 'Short1A' })
    ).rejects.toThrow(/at least 15/i);
  });

  it('rejects passwords longer than 128 characters', async () => {
    const tooLong = 'a'.repeat(129);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: tooLong })
    ).rejects.toThrow(/not exceed 128/i);
  });

  it('accepts passwords with spaces (NIST §5.1.1)', async () => {
    const pwWithSpace = 'correct horse battery';
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(
      makeUser({ email: 'a@b.com' })
    );
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: pwWithSpace })
    ).resolves.toBeDefined();
  });

  it('rejects passwords in the blocklist (common pattern)', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: 'password1234567' })
    ).rejects.toThrow(/too common/i);
  });

  it('rejects all-same-character patterns', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: 'aaaaaaaaaaaaaaa' })
    ).rejects.toThrow(/too common/i);
  });

  it('rejects pure numeric passwords', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: '123456789012345' })
    ).rejects.toThrow(/too common/i);
  });

  it('accepts a valid 15+ char passphrase without composition requirements', async () => {
    // No upper, no digit, no special — NIST removes composition rules
    const passphrase = 'correct horse battery staple 42';
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(
      makeUser({ email: 'a@b.com' })
    );
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();
    await expect(
      service.register({ email: 'a@b.com', name: 'Test', password: passphrase })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

describe('register', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;
  const validPassword = 'Tr0ub4dor&3 is a great passphrase!';

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('creates user and returns tokens on success', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(
      makeUser({ email: 'alice@example.com' })
    );
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    const result = await service.register({
      email: 'alice@example.com',
      name: 'Alice',
      password: validPassword
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('alice@example.com');
    expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('normalizes email to lowercase before persisting', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(
      makeUser({ email: 'alice@example.com' })
    );
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    await service.register({ email: 'Alice@Example.COM', name: 'Alice', password: validPassword });

    const createUserCall = (repo.createUser as MockedFunction<typeof repo.createUser>).mock.calls[0][0];
    expect(createUserCall.email).toBe('alice@example.com');
  });

  it('returns generic error when email already exists — does not say "already in use"', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(
      makeUser()
    );

    await expect(
      service.register({ email: 'alice@example.com', name: 'Alice', password: validPassword })
    ).rejects.toThrow(/registration unsuccessful/i);
  });

  it('stores hash version 1 for new users', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(makeUser());
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    await service.register({ email: 'alice@example.com', name: 'Alice', password: validPassword });

    const call = (repo.createUser as MockedFunction<typeof repo.createUser>).mock.calls[0][0];
    expect(call.passwordHashVersion).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('login', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;
  let passwordService: PasswordService;
  const rawPassword = 'Tr0ub4dor&3 is a great passphrase!';

  beforeEach(async () => {
    repo = makeRepo();
    passwordService = makePasswordService();
    service = new AuthService(repo, passwordService);
  });

  async function userWithHash(password: string, version = 1): Promise<User> {
    const { hash } = await passwordService.hash(password);
    return makeUser({ passwordHash: hash, passwordHashVersion: version });
  }

  it('returns tokens for correct credentials', async () => {
    const user = await userWithHash(rawPassword);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(user);
    (repo.resetLoginFailures as MockedFunction<typeof repo.resetLoginFailures>).mockResolvedValue();
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    const result = await service.login({ email: 'alice@example.com', password: rawPassword });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('returns generic 401 for wrong password — same message as missing user', async () => {
    const user = await userWithHash(rawPassword);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(user);
    (repo.incrementLoginFailures as MockedFunction<typeof repo.incrementLoginFailures>).mockResolvedValue(
      { failureCount: 1, lockedUntil: null } as LockoutState
    );

    await expect(
      service.login({ email: 'alice@example.com', password: 'wrongpassword!!!!!' })
    ).rejects.toThrow('Invalid credentials.');
  });

  it('returns generic 401 for non-existent user — same message as wrong password', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: rawPassword })
    ).rejects.toThrow('Invalid credentials.');
  });

  it('returns generic 401 when account has no local password', async () => {
    const user = makeUser({ passwordHash: null });
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(user);
    (repo.incrementLoginFailures as MockedFunction<typeof repo.incrementLoginFailures>).mockResolvedValue(
      { failureCount: 1, lockedUntil: null } as LockoutState
    );

    await expect(
      service.login({ email: 'alice@example.com', password: rawPassword })
    ).rejects.toThrow('Invalid credentials.');

    expect(repo.incrementLoginFailures).toHaveBeenCalledWith('user-1', expect.any(Number));
  });

  it('rejects login when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    const user = await userWithHash(rawPassword);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue({
      ...user,
      lockedUntil
    });

    await expect(
      service.login({ email: 'alice@example.com', password: rawPassword })
    ).rejects.toThrow(/locked/i);
  });

  it('resets failure count after successful login', async () => {
    const user = await userWithHash(rawPassword);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue({
      ...user,
      loginFailureCount: 3
    });
    (repo.resetLoginFailures as MockedFunction<typeof repo.resetLoginFailures>).mockResolvedValue();
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    await service.login({ email: 'alice@example.com', password: rawPassword });

    expect(repo.resetLoginFailures).toHaveBeenCalledWith('user-1');
  });

  it('increments failure count on bad password', async () => {
    const user = await userWithHash(rawPassword);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(user);
    (repo.incrementLoginFailures as MockedFunction<typeof repo.incrementLoginFailures>).mockResolvedValue(
      { failureCount: 1, lockedUntil: null } as LockoutState
    );

    await expect(
      service.login({ email: 'alice@example.com', password: 'wrongwrongwrongwrong' })
    ).rejects.toThrow();

    expect(repo.incrementLoginFailures).toHaveBeenCalledWith('user-1', expect.any(Number));
  });

  it('triggers migration-on-login for v0 (legacy) hashes', async () => {
    // Create a v0 hash (plain bcrypt, no pepper)
    const { hash: legacyHash } = await passwordService.hash(rawPassword);
    const user = makeUser({ passwordHash: legacyHash, passwordHashVersion: 0 });

    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(user);
    (repo.resetLoginFailures as MockedFunction<typeof repo.resetLoginFailures>).mockResolvedValue();
    (repo.updateUserPassword as MockedFunction<typeof repo.updateUserPassword>).mockResolvedValue();
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    // For v0, verify uses plain bcrypt — use bcryptjs directly to create a real v0 hash
    const bcrypt = await import('bcryptjs');
    const v0Hash = await bcrypt.hash(rawPassword, 4);
    const userV0 = makeUser({ passwordHash: v0Hash, passwordHashVersion: 0 });
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(userV0);

    await service.login({ email: 'alice@example.com', password: rawPassword });

    expect(repo.updateUserPassword).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ hashVersion: 1 })
    );
  });
});

describe('loginWithExternal', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('logs in when external identity already exists', async () => {
    const linkedUser = makeUser({ email: 'alice@example.com' });
    (repo.findUserByExternalIdentity as MockedFunction<typeof repo.findUserByExternalIdentity>).mockResolvedValue(linkedUser);
    (repo.linkExternalIdentity as MockedFunction<typeof repo.linkExternalIdentity>).mockResolvedValue();
    (repo.resetLoginFailures as MockedFunction<typeof repo.resetLoginFailures>).mockResolvedValue();
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    const result = await service.loginWithExternal({
      provider: 'GOOGLE',
      providerSubject: 'google-sub-1',
      email: 'alice@example.com',
      name: 'Alice Example',
      emailVerified: true
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe('alice@example.com');
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
  });

  it('creates user and links provider when email does not exist', async () => {
    (repo.findUserByExternalIdentity as MockedFunction<typeof repo.findUserByExternalIdentity>).mockResolvedValue(null);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);
    (repo.createUser as MockedFunction<typeof repo.createUser>).mockResolvedValue(
      makeUser({ id: 'new-user', email: 'new@example.com', passwordHash: null })
    );
    (repo.linkExternalIdentity as MockedFunction<typeof repo.linkExternalIdentity>).mockResolvedValue();
    (repo.resetLoginFailures as MockedFunction<typeof repo.resetLoginFailures>).mockResolvedValue();
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    const result = await service.loginWithExternal({
      provider: 'GOOGLE',
      providerSubject: 'google-sub-2',
      email: 'new@example.com',
      name: 'New User',
      emailVerified: true
    });

    expect(result.user.email).toBe('new@example.com');
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', passwordHash: null })
    );
    expect(repo.linkExternalIdentity).toHaveBeenCalledTimes(1);
  });

  it('does not auto-link when email already exists without external identity', async () => {
    (repo.findUserByExternalIdentity as MockedFunction<typeof repo.findUserByExternalIdentity>).mockResolvedValue(null);
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(
      makeUser({ id: 'local-user', email: 'alice@example.com' })
    );

    await expect(
      service.loginWithExternal({
        provider: 'GOOGLE',
        providerSubject: 'google-sub-3',
        email: 'alice@example.com',
        name: 'Alice Example',
        emailVerified: true
      })
    ).rejects.toThrow(/already exists/i);

    expect(repo.linkExternalIdentity).not.toHaveBeenCalled();
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------

describe('refresh', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('returns new tokens on valid refresh', async () => {
    const rt = makeRefreshToken();
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);
    (repo.revokeRefreshToken as MockedFunction<typeof repo.revokeRefreshToken>).mockResolvedValue(true);
    (repo.findUserById as MockedFunction<typeof repo.findUserById>).mockResolvedValue(makeUser());
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    const result = await service.refresh('raw-token');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('preserves familyId on rotation', async () => {
    const rt = makeRefreshToken({ familyId: 'my-family' });
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);
    (repo.revokeRefreshToken as MockedFunction<typeof repo.revokeRefreshToken>).mockResolvedValue(true);
    (repo.findUserById as MockedFunction<typeof repo.findUserById>).mockResolvedValue(makeUser());
    (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>).mockResolvedValue();

    await service.refresh('raw-token');

    const createCall = (repo.createRefreshToken as MockedFunction<typeof repo.createRefreshToken>)
      .mock.calls[0][0];
    expect(createCall.familyId).toBe('my-family');
  });

  it('rejects expired refresh tokens', async () => {
    const rt = makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) });
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);

    await expect(service.refresh('raw-token')).rejects.toThrow(/expired/i);
  });

  it('rejects when token does not exist', async () => {
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(null);

    await expect(service.refresh('raw-token')).rejects.toThrow(/invalid/i);
  });

  it('detects reuse: revokes entire family when revoked token is presented', async () => {
    const rt = makeRefreshToken({ revokedAt: new Date(), familyId: 'stolen-family' });
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);
    (repo.revokeTokenFamily as MockedFunction<typeof repo.revokeTokenFamily>).mockResolvedValue();

    await expect(service.refresh('raw-token')).rejects.toThrow(/invalidated/i);

    expect(repo.revokeTokenFamily).toHaveBeenCalledWith('stolen-family');
  });

  it('handles concurrent refresh race: second concurrent call rejected', async () => {
    // revokeRefreshToken returns false → someone else already revoked it
    const rt = makeRefreshToken();
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);
    (repo.revokeRefreshToken as MockedFunction<typeof repo.revokeRefreshToken>).mockResolvedValue(false);

    await expect(service.refresh('raw-token')).rejects.toThrow(/invalid/i);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('revokes the presented token', async () => {
    const rt = makeRefreshToken();
    (repo.findRefreshToken as MockedFunction<typeof repo.findRefreshToken>).mockResolvedValue(rt);
    (repo.revokeRefreshToken as MockedFunction<typeof repo.revokeRefreshToken>).mockResolvedValue(true);

    await service.logout('raw-token');
    expect(repo.revokeRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('logout-all revokes all tokens for the user', async () => {
    (repo.revokeAllUserRefreshTokens as MockedFunction<typeof repo.revokeAllUserRefreshTokens>).mockResolvedValue();

    await service.logoutAll('user-1');
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
  });
});

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

describe('me', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('returns user profile without sensitive fields', async () => {
    (repo.findUserById as MockedFunction<typeof repo.findUserById>).mockResolvedValue(makeUser());

    const profile = await service.me('user-1');

    expect(profile.id).toBe('user-1');
    expect(profile.email).toBe('alice@example.com');
    expect((profile as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((profile as unknown as Record<string, unknown>).passwordHashVersion).toBeUndefined();
    expect((profile as unknown as Record<string, unknown>).loginFailureCount).toBeUndefined();
  });

  it('throws 404 when user does not exist', async () => {
    (repo.findUserById as MockedFunction<typeof repo.findUserById>).mockResolvedValue(null);

    await expect(service.me('ghost')).rejects.toThrow(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

describe('requestPasswordReset', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  it('returns generic 200 even when email does not exist', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(null);

    const result = await service.requestPasswordReset('nobody@example.com');
    expect(result).toEqual({});
  });

  it('creates reset token when user exists', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(makeUser());
    (repo.countActiveResetTokens as MockedFunction<typeof repo.countActiveResetTokens>).mockResolvedValue(0);
    (repo.createPasswordResetToken as MockedFunction<typeof repo.createPasswordResetToken>).mockResolvedValue();

    await service.requestPasswordReset('alice@example.com');
    expect(repo.createPasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it('rate-limits: skips creating token when one already exists', async () => {
    (repo.findUserByEmail as MockedFunction<typeof repo.findUserByEmail>).mockResolvedValue(makeUser());
    (repo.countActiveResetTokens as MockedFunction<typeof repo.countActiveResetTokens>).mockResolvedValue(1);

    await service.requestPasswordReset('alice@example.com');
    expect(repo.createPasswordResetToken).not.toHaveBeenCalled();
  });
});

describe('confirmPasswordReset', () => {
  let service: AuthService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new AuthService(repo, makePasswordService());
  });

  function makeResetToken(overrides: Partial<StoredPasswordResetToken> = {}): StoredPasswordResetToken {
    return {
      id: 'prt-1',
      userId: 'user-1',
      tokenHash: 'hashed-reset-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
      ...overrides
    };
  }

  it('resets password and revokes all sessions on success', async () => {
    const resetToken = makeResetToken();
    (repo.findPasswordResetToken as MockedFunction<typeof repo.findPasswordResetToken>).mockResolvedValue(resetToken);
    (repo.markPasswordResetTokenUsed as MockedFunction<typeof repo.markPasswordResetTokenUsed>).mockResolvedValue();
    (repo.updateUserPassword as MockedFunction<typeof repo.updateUserPassword>).mockResolvedValue();
    (repo.revokeAllUserRefreshTokens as MockedFunction<typeof repo.revokeAllUserRefreshTokens>).mockResolvedValue();
    (repo.revokeUserResetTokens as MockedFunction<typeof repo.revokeUserResetTokens>).mockResolvedValue();

    await service.confirmPasswordReset({
      token: 'raw-token',
      newPassword: 'new secure passphrase for test 2024'
    });

    expect(repo.markPasswordResetTokenUsed).toHaveBeenCalledTimes(1);
    expect(repo.updateUserPassword).toHaveBeenCalledWith('user-1', expect.objectContaining({ hashVersion: 1 }));
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
  });

  it('rejects expired reset token', async () => {
    (repo.findPasswordResetToken as MockedFunction<typeof repo.findPasswordResetToken>).mockResolvedValue(
      makeResetToken({ expiresAt: new Date(Date.now() - 1000) })
    );

    await expect(
      service.confirmPasswordReset({ token: 'raw', newPassword: 'new secure passphrase for test' })
    ).rejects.toThrow(/expired/i);
  });

  it('rejects already-used reset token', async () => {
    (repo.findPasswordResetToken as MockedFunction<typeof repo.findPasswordResetToken>).mockResolvedValue(
      makeResetToken({ usedAt: new Date() })
    );

    await expect(
      service.confirmPasswordReset({ token: 'raw', newPassword: 'new secure passphrase for test' })
    ).rejects.toThrow(/expired/i);
  });

  it('rejects short new password in reset flow', async () => {
    (repo.findPasswordResetToken as MockedFunction<typeof repo.findPasswordResetToken>).mockResolvedValue(
      makeResetToken()
    );

    await expect(
      service.confirmPasswordReset({ token: 'raw', newPassword: 'short' })
    ).rejects.toThrow(/at least 15/i);
  });
});

// ---------------------------------------------------------------------------
// PasswordService — unit tests
// ---------------------------------------------------------------------------

describe('PasswordService', () => {
  const ps = new PasswordService(TEST_PEPPER, LOW_ROUNDS);

  it('throws when pepper is too short', () => {
    expect(() => new PasswordService('short')).toThrow(/pepper/i);
  });

  it('hash and verify round-trip succeeds for v1', async () => {
    const password = 'my long test passphrase 2024!!';
    const { hash, version } = await ps.hash(password);
    expect(version).toBe(1);
    const ok = await ps.verify(password, hash, 1);
    expect(ok).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const { hash } = await ps.hash('correct passphrase!!!!');
    const ok = await ps.verify('wrong passphrase!!!!', hash, 1);
    expect(ok).toBe(false);
  });

  it('handles long Unicode passwords without truncation', async () => {
    // 20 four-byte emoji = 80 bytes — exceeds bcrypt 72-byte limit in plain mode
    const unicodePassword = '🔐'.repeat(20); // 80 bytes raw
    const { hash, version } = await ps.hash(unicodePassword);
    const ok = await ps.verify(unicodePassword, hash, version);
    expect(ok).toBe(true);
  });

  it('NFC normalization: visually identical Unicode passwords match', async () => {
    // 'é' can be U+00E9 (NFC) or U+0065 U+0301 (NFD — composed differently)
    const nfd = 'caf\u0065\u0301 au lait passphrase'; // NFD 'é'
    const nfc = 'caf\u00E9 au lait passphrase';         // NFC 'é'
    const { hash, version } = await ps.hash(nfc);
    const ok = await ps.verify(nfd, hash, version);
    expect(ok).toBe(true);
  });

  it('needsUpgrade returns true for v0, false for current version', () => {
    expect(ps.needsUpgrade(0)).toBe(true);
    expect(ps.needsUpgrade(1)).toBe(false);
  });

  it('v0 legacy verify works with plain bcrypt hash', async () => {
    const bcrypt = await import('bcryptjs');
    const legacyHash = await bcrypt.hash('legacy passphrase test here', LOW_ROUNDS);
    const ok = await ps.verify('legacy passphrase test here', legacyHash, 0);
    expect(ok).toBe(true);
  });
});
