import { redactErrorMessage, redactMetadata } from '@/core/security/redaction';

const BILLING_SENSITIVE_METADATA_KEYS = new Set([
  'clientportalurl',
  'clientaccesstoken',
  'billingtoken',
  'portaltoken'
]);

export function redactBillingSecretValue(value: unknown): string {
  return redactErrorMessage(value);
}

export function redactBillingMetadata<T extends Record<string, unknown>>(metadata: T): T {
  const redacted = redactMetadata(metadata) as Record<string, unknown>;
  for (const key of Object.keys(redacted)) {
    if (BILLING_SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted as T;
}
