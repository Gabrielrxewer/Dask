import { maskEmail, maskPhone } from '@/core/security/redaction';

const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeCommunicationAddress(channel: string, address: string): string {
  const normalized = address.trim();
  const normalizedChannel = channel.trim().toLowerCase();
  if (normalizedChannel === 'email') {
    return normalized.toLowerCase();
  }
  if (normalizedChannel === 'phone' || normalizedChannel === 'whatsapp') {
    return normalizePhoneAddress(normalized).normalized;
  }

  return normalized;
}

export function isValidEmailAddress(address: string): boolean {
  return basicEmailPattern.test(address.trim().toLowerCase());
}

export function maskCommunicationAddress(channel: string, address: string): string {
  const normalized = normalizeCommunicationAddress(channel, address);
  if (channel.trim().toLowerCase() !== 'email') {
    return maskPhone(normalized) ?? '****';
  }

  return maskEmail(normalized) ?? '***';
}

export type NormalizedPhone = {
  normalized: string;
  status: 'active' | 'unverified' | 'invalid';
};

export function normalizePhoneAddress(
  value: string,
  input?: {
    defaultDdi?: string;
  }
): NormalizedPhone {
  const raw = value.trim();
  if (!raw) {
    return { normalized: '', status: 'invalid' };
  }

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) {
    return { normalized: digits, status: 'invalid' };
  }

  const defaultDdi = (input?.defaultDdi ?? '55').replace(/\D/g, '');
  const normalized = hasPlus
    ? `+${digits}`
    : digits.startsWith(defaultDdi) && digits.length >= 12
      ? `+${digits}`
      : `+${defaultDdi}${digits}`;

  return {
    normalized,
    status: /^\+\d{10,15}$/.test(normalized) ? 'unverified' : 'invalid'
  };
}
