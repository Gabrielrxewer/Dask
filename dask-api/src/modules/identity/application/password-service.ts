/**
 * Versioned password hashing service — NIST SP 800-63B §5.1.1.2
 *
 * Hash versions:
 *   0 — Legacy: plain bcrypt(password, rounds).
 *       Exists only for backward-compatibility with hashes created before
 *       this migration. On successful login, the service re-hashes to v1.
 *
 *   1 — Current: HMAC-SHA256(NFC(password), pepper) → base64 → bcrypt(hash, rounds).
 *       Advantages over plain bcrypt:
 *         · Pepper adds a server-side secret not stored in the DB — attacker
 *           who dumps the DB cannot mount an offline dictionary attack without
 *           also knowing the pepper (NIST §5.1.1.2, keyed hashing guidance).
 *         · HMAC output is exactly 44 base64 chars → eliminates bcrypt's
 *           silent 72-byte truncation, which would make long passwords
 *           (common with passphrases or Unicode) incorrectly equivalent.
 *         · NFC normalization ensures visually identical Unicode passwords
 *           always produce the same hash (NIST §5.1.1.2 Unicode guidance).
 *
 * Pepper rotation:
 *   To rotate the pepper, add HASH_PEPPER_NEXT to env, deploy, and run a
 *   background job that re-hashes on next successful login (migration-on-login
 *   already implemented in AuthService). Once all rows reach the new version,
 *   remove the old pepper from env.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { normalizePassword } from '@/modules/identity/domain/password-policy';

export const CURRENT_HASH_VERSION = 1;
const BCRYPT_ROUNDS_DEFAULT = 12;

export class PasswordService {
  private readonly pepper: string;
  private readonly rounds: number;

  public constructor(pepper: string, rounds: number = BCRYPT_ROUNDS_DEFAULT) {
    if (!pepper || pepper.length < 32) {
      throw new Error('PasswordService: pepper must be at least 32 characters');
    }
    this.pepper = pepper;
    this.rounds = rounds;
  }

  /**
   * Hash a new password using the current (latest) algorithm version.
   * Returns the bcrypt hash string and the version number to store in the DB.
   */
  public async hash(rawPassword: string): Promise<{ hash: string; version: number }> {
    const preHashed = this.preHash(normalizePassword(rawPassword));
    const hash = await bcrypt.hash(preHashed, this.rounds);
    return { hash, version: CURRENT_HASH_VERSION };
  }

  /**
   * Verify a raw password against a stored hash, taking the stored version
   * into account so legacy v0 hashes continue to work.
   */
  public async verify(
    rawPassword: string,
    storedHash: string,
    storedVersion: number
  ): Promise<boolean> {
    if (storedVersion === 0) {
      // Legacy path: plain bcrypt (no pepper, no pre-hashing).
      // bcrypt.compare is safe here; truncation at 72 bytes was present in the
      // old scheme, but this path only exists for backward-compatibility.
      return bcrypt.compare(rawPassword, storedHash);
    }

    // v1+: HMAC-SHA256(NFC(password), pepper) → bcrypt
    const preHashed = this.preHash(normalizePassword(rawPassword));
    return bcrypt.compare(preHashed, storedHash);
  }

  /**
   * Returns true when the stored version is older than the current scheme
   * and the hash should be re-computed on next successful login.
   */
  public needsUpgrade(storedVersion: number): boolean {
    return storedVersion < CURRENT_HASH_VERSION;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * HMAC-SHA256(pepper, normalizedPassword) → base64 string (44 chars).
   * Fixed output length guarantees bcrypt never truncates the input,
   * regardless of how long or Unicode-heavy the original password is.
   */
  private preHash(normalized: string): string {
    return crypto.createHmac('sha256', this.pepper).update(normalized, 'utf8').digest('base64');
  }
}
