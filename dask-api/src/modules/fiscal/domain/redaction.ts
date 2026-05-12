import { redactSensitiveValue } from '@/core/security/redaction';

export function maskFiscalSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 8) {
    return '***';
  }

  return `${normalized.slice(0, 4)}***${normalized.slice(-2)}`;
}

export function redactFiscalCredentials<T>(value: T): T {
  return redactSensitiveValue(value, {
    maskPersonalData: true,
    maxDepth: 8
  });
}

export function redactFiscalLogData<T>(value: T): T {
  return redactSensitiveValue(value, {
    maskPersonalData: true,
    maskBrazilianDocuments: true,
    maxDepth: 8
  });
}
