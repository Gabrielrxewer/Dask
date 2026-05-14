export type RuntimeEnvironment = 'development' | 'test' | 'production';
export type StripeEnvironment = 'test' | 'live';
export type FocusApiEnvironment = 'homologacao' | 'producao';

export interface ProductionCriticalConfigInput {
  nodeEnv: RuntimeEnvironment;
  rawEnv?: Record<string, string | undefined>;
  stripeEnvironment?: StripeEnvironment;
  stripeSecretKey?: string | null;
  stripePublicKey?: string | null;
  stripeWebhookSecret?: string | null;
  stripeFiscalWebhookSecret?: string | null;
  billingPortalTokenSecret?: string | null;
  stripePriceIdPersonalMonthly?: string | null;
  stripePriceIdBasicMonthly?: string | null;
  stripePriceIdProMonthly?: string | null;
  stripePriceIdBusinessMonthly?: string | null;
  stripePriceIdEnterpriseMonthly?: string | null;
  stripeConnectApplicationFeeBps?: number | null;
  stripeConnectRequiredCapabilities?: string[];
  focusApiEnvironment?: FocusApiEnvironment;
  focusApiBaseUrl?: string | null;
  focusWebhookSecret?: string | null;
}

export interface ProductionCriticalConfigViolation {
  env: string;
  reason: 'missing' | 'weak' | 'invalid' | 'sandbox_production_mismatch';
  message: string;
}

const CORE_CONNECT_CAPABILITIES = ['charges_enabled', 'transfers', 'card_payments'] as const;
const ALLOWED_CONNECT_CAPABILITIES = new Set([
  ...CORE_CONNECT_CAPABILITIES,
  'boleto_payments',
  'pix_payments'
]);

const PLACEHOLDER_PATTERNS = [
  /change[-_ ]?me/i,
  /replace[-_ ]?me/i,
  /example/i,
  /dummy/i,
  /default/i,
  /xxxx/i,
  /muda[-_ ]?isto/i,
  /minimo[-_ ]?\d+/i,
  /cole[-_ ]?aqui/i,
  /do[-_ ]?not[-_ ]?use/i
];

function normalized(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function rawValue(input: ProductionCriticalConfigInput, key: string): string {
  return normalized(input.rawEnv?.[key]);
}

function hasValue(value: string | null | undefined): boolean {
  return normalized(value).length > 0;
}

function secretLooksWeak(value: string, minLength: number): boolean {
  const candidate = value.trim();
  if (candidate.length < minLength) {
    return true;
  }

  const lower = candidate.toLowerCase();
  if (['secret', 'password', 'token', 'changeme', 'test', 'local'].includes(lower)) {
    return true;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(candidate));
}

function requireValue(
  violations: ProductionCriticalConfigViolation[],
  envName: string,
  value: string | null | undefined
): boolean {
  if (hasValue(value)) {
    return true;
  }

  violations.push({
    env: envName,
    reason: 'missing',
    message: `${envName} is required in production`
  });
  return false;
}

function requireStrongSecret(input: {
  violations: ProductionCriticalConfigViolation[];
  envName: string;
  value: string | null | undefined;
  minLength: number;
}): void {
  if (!requireValue(input.violations, input.envName, input.value)) {
    return;
  }

  if (secretLooksWeak(normalized(input.value), input.minLength)) {
    input.violations.push({
      env: input.envName,
      reason: 'weak',
      message: `${input.envName} must be a strong explicit secret`
    });
  }
}

function requirePrefix(input: {
  violations: ProductionCriticalConfigViolation[];
  envName: string;
  value: string | null | undefined;
  prefix: string;
  mismatchReason?: ProductionCriticalConfigViolation['reason'];
}): void {
  if (!requireValue(input.violations, input.envName, input.value)) {
    return;
  }

  if (!normalized(input.value).startsWith(input.prefix)) {
    input.violations.push({
      env: input.envName,
      reason: input.mismatchReason ?? 'invalid',
      message: `${input.envName} must start with ${input.prefix} in production`
    });
  }
}

function validateStripeProductionConfig(
  input: ProductionCriticalConfigInput,
  violations: ProductionCriticalConfigViolation[]
): void {
  const explicitStripeEnvironment = rawValue(input, 'STRIPE_ENVIRONMENT');
  if (!explicitStripeEnvironment) {
    violations.push({
      env: 'STRIPE_ENVIRONMENT',
      reason: 'missing',
      message: 'STRIPE_ENVIRONMENT=live is required in production'
    });
  } else if (explicitStripeEnvironment !== 'live' || input.stripeEnvironment !== 'live') {
    violations.push({
      env: 'STRIPE_ENVIRONMENT',
      reason: 'sandbox_production_mismatch',
      message: 'Production must use STRIPE_ENVIRONMENT=live'
    });
  }

  requirePrefix({
    violations,
    envName: 'STRIPE_SECRET_KEY',
    value: input.stripeSecretKey,
    prefix: 'sk_live_',
    mismatchReason: 'sandbox_production_mismatch'
  });
  requirePrefix({
    violations,
    envName: 'STRIPE_PUBLIC_KEY',
    value: input.stripePublicKey,
    prefix: 'pk_live_',
    mismatchReason: 'sandbox_production_mismatch'
  });
  requirePrefix({
    violations,
    envName: 'STRIPE_WEBHOOK_SECRET',
    value: input.stripeWebhookSecret,
    prefix: 'whsec_'
  });
  requireStrongSecret({
    violations,
    envName: 'BILLING_PORTAL_TOKEN_SECRET',
    value: input.billingPortalTokenSecret,
    minLength: 32
  });
  requirePrefix({
    violations,
    envName: 'STRIPE_WEBHOOK_SECRET_FISCAL',
    value: input.stripeFiscalWebhookSecret,
    prefix: 'whsec_'
  });

  if (!rawValue(input, 'STRIPE_CONNECT_APPLICATION_FEE_BPS')) {
    violations.push({
      env: 'STRIPE_CONNECT_APPLICATION_FEE_BPS',
      reason: 'missing',
      message: 'STRIPE_CONNECT_APPLICATION_FEE_BPS must be explicit in production'
    });
  } else if (
    typeof input.stripeConnectApplicationFeeBps !== 'number' ||
    !Number.isInteger(input.stripeConnectApplicationFeeBps) ||
    input.stripeConnectApplicationFeeBps < 0 ||
    input.stripeConnectApplicationFeeBps > 10_000
  ) {
    violations.push({
      env: 'STRIPE_CONNECT_APPLICATION_FEE_BPS',
      reason: 'invalid',
      message: 'STRIPE_CONNECT_APPLICATION_FEE_BPS must be between 0 and 10000'
    });
  }

  const explicitCapabilities = rawValue(input, 'STRIPE_CONNECT_REQUIRED_CAPABILITIES');
  const capabilities = input.stripeConnectRequiredCapabilities ?? [];
  if (!explicitCapabilities || capabilities.length === 0) {
    violations.push({
      env: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES',
      reason: 'missing',
      message: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES must be explicit in production'
    });
  }

  const unknownCapabilities = capabilities.filter((capability) => !ALLOWED_CONNECT_CAPABILITIES.has(capability));
  if (unknownCapabilities.length > 0) {
    violations.push({
      env: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES',
      reason: 'invalid',
      message: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES contains unsupported capabilities'
    });
  }

  const missingCoreCapabilities = CORE_CONNECT_CAPABILITIES.filter(
    (capability) => !capabilities.includes(capability)
  );
  if (missingCoreCapabilities.length > 0) {
    violations.push({
      env: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES',
      reason: 'invalid',
      message: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES must include charges_enabled, transfers and card_payments'
    });
  }
}

function validateFocusProductionConfig(
  input: ProductionCriticalConfigInput,
  violations: ProductionCriticalConfigViolation[]
): void {
  const explicitFocusEnvironment = rawValue(input, 'FOCUS_API_ENVIRONMENT');
  if (!explicitFocusEnvironment) {
    violations.push({
      env: 'FOCUS_API_ENVIRONMENT',
      reason: 'missing',
      message: 'FOCUS_API_ENVIRONMENT=producao is required in production'
    });
  } else if (explicitFocusEnvironment !== 'producao' || input.focusApiEnvironment !== 'producao') {
    violations.push({
      env: 'FOCUS_API_ENVIRONMENT',
      reason: 'sandbox_production_mismatch',
      message: 'Production must use FOCUS_API_ENVIRONMENT=producao'
    });
  }

  if (!rawValue(input, 'FOCUS_API_BASE_URL')) {
    violations.push({
      env: 'FOCUS_API_BASE_URL',
      reason: 'missing',
      message: 'FOCUS_API_BASE_URL must be explicit in production'
    });
  } else {
    try {
      const url = new URL(normalized(input.focusApiBaseUrl));
      const hostAndPath = `${url.hostname}${url.pathname}`.toLowerCase();
      if (url.protocol !== 'https:' || hostAndPath.includes('homolog') || hostAndPath.includes('sandbox')) {
        violations.push({
          env: 'FOCUS_API_BASE_URL',
          reason: 'sandbox_production_mismatch',
          message: 'FOCUS_API_BASE_URL must point to the production HTTPS Focus API in production'
        });
      }
    } catch {
      violations.push({
        env: 'FOCUS_API_BASE_URL',
        reason: 'invalid',
        message: 'FOCUS_API_BASE_URL must be a valid URL'
      });
    }
  }

  requireStrongSecret({
    violations,
    envName: 'FOCUS_WEBHOOK_SECRET',
    value: input.focusWebhookSecret,
    minLength: 32
  });
}

export function validateProductionCriticalConfig(
  input: ProductionCriticalConfigInput
): ProductionCriticalConfigViolation[] {
  if (input.nodeEnv !== 'production') {
    return [];
  }

  const violations: ProductionCriticalConfigViolation[] = [];
  validateStripeProductionConfig(input, violations);
  validateFocusProductionConfig(input, violations);
  return violations;
}

export function assertProductionCriticalConfig(input: ProductionCriticalConfigInput): void {
  const violations = validateProductionCriticalConfig(input);
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `${violation.env}: ${violation.reason}`)
    .join(', ');
  throw new Error(`Production Billing/Fiscal configuration is invalid: ${details}`);
}
