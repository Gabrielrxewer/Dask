/**
 * DTOs for the identity / auth module.
 *
 * Password policy - NIST SP 800-63B 5.1.1:
 *   - Minimum 15 characters (single-factor authenticator)
 *   - Maximum 128 characters
 *   - No composition rules
 *   - Accepts printable characters, including spaces and Unicode
 */

import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/modules/identity/domain/password-policy';

export const registerDto = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).trim(),
  legalAcceptance: z.object({
    termsVersion: z.string().min(1).max(40),
    privacyVersion: z.string().min(1).max(40),
    acceptedTerms: z.literal(true),
    acceptedPrivacy: z.literal(true),
    acceptedMarketing: z.boolean().optional().default(false),
    acceptedNonEssentialCookies: z.boolean().optional().default(false)
  }),
  inviteToken: z.string().min(1).optional(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
    .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
});

export const loginDto = z.object({
  email: z.string().email(),
  inviteToken: z.string().min(1).optional(),
  // Do not enforce register-time password constraints at login.
  password: z.string().min(1)
});

export const requestPasswordResetDto = z.object({
  email: z.string().email()
});

export const confirmPasswordResetDto = z.object({
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
    .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
});

export const createOrganizationDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  settings: z.record(z.unknown()).optional()
});

export const updateUserAvatarDto = z.object({
  manualAvatarDataUrl: z.string().min(1).max(3_000_000).nullable(),
  removeProviderAvatar: z.boolean().optional()
});

export const updateUserProfileDto = z.object({
  name: z.string().min(2).max(100).trim()
});
