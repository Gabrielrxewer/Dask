/**
 * NIST SP 800-63B §5.1.1 — Memorized Secret Policy
 *
 * Key requirements implemented here:
 *  - Minimum 15 characters (single-factor authenticator)
 *  - Maximum 128 characters (no truncation, allow pass-phrases)
 *  - NO composition rules (no forced upper/lower/digit/special)
 *  - Accept all printable ASCII (0x20–0x7E) including space
 *  - Accept Unicode; normalize to NFC before hashing
 *  - Verify against blocklist of common / compromised passwords
 *  - Do NOT force periodic rotation
 *  - Do NOT use hints or security questions
 *  - Do NOT prevent paste or autofill (enforced at client; API must not restrict)
 */

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * NFC-normalize a password before hashing or comparison.
 * Ensures canonical Unicode representation so that visually identical
 * characters from different code-point sequences produce the same hash.
 * NIST SP 800-63B §5.1.1.2 recommends applying the Normalization Process
 * for Stabilized Strings in Unicode 15 or later.
 */
export function normalizePassword(password: string): string {
  return password.normalize('NFC');
}

/**
 * Normalize an email identifier before storage and lookup.
 * Trim whitespace and lowercase the entire address.
 * This prevents account enumeration via case/whitespace variations and
 * ensures consistent identity across login/register/reset flows.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Pattern-based weak-password detection
// Covers predictable 15+ char passwords that a static list would miss.
// ---------------------------------------------------------------------------

const WEAK_PATTERNS: RegExp[] = [
  /^(.)\1{14,}$/,                          // all same char: "aaaaaaaaaaaaaaa"
  /^(0123456789){1,}0*$/,                  // ascending digits repeated
  /^(9876543210){1,}9*$/,                  // descending digits repeated
  /^1234567890{1,}$/,                      // 1234567890...
  /^0987654321{1,}$/,                      // 0987654321...
  /^(abcdefghijklmnopqrstuvwxyz){1,}$/,   // alphabet repeated
  /^(qwertyuiop){1,}(asdfghjkl)?(zxcvbn)?$/, // keyboard rows
  /^(password){1,}[0-9!@#$%^&*]*$/i,      // "password" + padding
  /^(letmein){1,}[0-9!@#$%^&*]*$/i,
  /^(iloveyou){1,}[0-9!@#$%^&*]*$/i,
  /^(welcome){1,}[0-9!@#$%^&*]*$/i,
  /^(admin){1,}[0-9!@#$%^&*]*$/i,
  /^(login){1,}[0-9!@#$%^&*]*$/i,
  /^(monkey){1,}[0-9!@#$%^&*]*$/i,
  /^(sunshine){1,}[0-9!@#$%^&*]*$/i,
  /^(dragon){1,}[0-9!@#$%^&*]*$/i,
  /^(master){1,}[0-9!@#$%^&*]*$/i,
  /^(superman){1,}[0-9!@#$%^&*]*$/i,
  /^(batman){1,}[0-9!@#$%^&*]*$/i,
  /^(princess){1,}[0-9!@#$%^&*]*$/i,
  /^(shadow){1,}[0-9!@#$%^&*]*$/i,
  /^(qwerty){1,}[0-9!@#$%^&*]*$/i,
  /^(asdfgh){1,}[0-9!@#$%^&*]*$/i,
  /^(zxcvbn){1,}[0-9!@#$%^&*]*$/i,
  /^[0-9]+$/,                               // pure numeric (any length)
];

/**
 * Static list of known common/compromised passwords that are ≥ 15 characters.
 * NIST SP 800-63B §5.1.1.2: verifiers SHALL compare the prospective secret
 * against a list that contains values known to be commonly-used, expected,
 * or compromised.
 *
 * This list covers predictable pass-phrases and padded common passwords.
 * For production, augment with the Have I Been Pwned k-anonymity API
 * (documented as infrastructure dependency in NIST-compliance.md).
 */
const COMMON_PASSWORDS = new Set([
  // Padded versions of the most common short passwords
  'password123456',
  'password1234567',
  'password12345678',
  'password123456789',
  'password1234567890',
  'passwordpassword',
  'passwordpassword1',
  'password!password',
  'p@ssword123456789',
  'passw0rd123456789',
  '1234567890123456',
  '12345678901234567',
  '123456789012345678',
  '1234567890abcdef',
  'letmein123456789',
  'letmein1234567890',
  'welcome123456789',
  'welcome1234567890',
  'iloveyou123456789',
  'iloveyou1234567890',
  'sunshine123456789',
  'sunshine1234567890',
  'adminadminadmin1',
  'administrator123',
  'administrator1234',
  'qwertyuiopasdfghj',
  'qwertyuiopassword',
  'asdfghjklzxcvbnm1',
  'trustno1trustno11',
  'changemechangeme1',
  'changeme123456789',
  'defaultpassword12',
  'defaultpassword123',
  'mypassword123456',
  'mypassword1234567',
  'correcthorsebattery',
  'correcthorsebatterystaple',
  'thequickbrownfox1',
  'thequickbrownfox12',
  'helloworld1234567',
  'helloworld12345678',
  'superheropassword',
  'monkey1234567890',
  'dragon1234567890',
  'master1234567890',
  'shadow1234567890',
  'batman1234567890',
  'superman12345678',
  'princess12345678',
  'football12345678',
  'baseball12345678',
  'soccer12345678901',
  'mustang1234567890',
  'michael123456789',
  'michelle12345678',
  'jessica123456789',
  'charlie123456789',
  'donald1234567890',
  'hunter2hunter2hun',
  'qazwsxedcrfvtgbyh',
  '1qaz2wsx3edc4rfv',
  '1q2w3e4r5t6y7u8i',
  'abcdefghijklmnop',
  'abcdefgh12345678',
  'abcdefghijklmno1',
  'zyxwvutsrqponmlkj',
  'zaqxswcdevfrbgtnhy',
  // Common phrases
  'iamthebest123456',
  'ilovemyself12345',
  'nevergiveyouup12',
  'itsasecret123456',
  'opensesame123456',
  'passw0rdpassw0rd',
  'securepassword12',
  'testpassword1234',
  'demopassword1234',
  'guestpassword123',
  'samplepassword12',
  'examplepassword1',
  'newpassword12345',
  'temppassword1234',
  'oldpassword12345',
  'myemail@email.co',
  'username12345678',
]);

/**
 * Returns true when the password matches a known-weak pattern or
 * appears in the common-passwords list.
 * Comparison is done on the lowercased, NFC-normalized form.
 */
function isWeakPassword(normalized: string): boolean {
  const lower = normalized.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  return WEAK_PATTERNS.some((p) => p.test(lower));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validate a password against NIST SP 800-63B §5.1.1 policy.
 * Call BEFORE hashing; input is the raw password from the request.
 */
export function validatePassword(rawPassword: string): PasswordValidationResult {
  if (rawPassword.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`
    };
  }

  if (rawPassword.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`
    };
  }

  const normalized = normalizePassword(rawPassword);

  if (isWeakPassword(normalized)) {
    return {
      ok: false,
      reason:
        'This password is too common or easily guessed. Please choose a longer, more unique password.'
    };
  }

  return { ok: true };
}
