import { redactErrorMessage, redactSensitiveValue } from '@/core/security/redaction';

export type RealSmokeProvider = 'stripePlatform' | 'stripeConnect' | 'focusFiscal' | 'aiProvider';

type SmokeEnv = Record<string, string | undefined>;

export interface ProviderSmokeDefinition {
  name: string;
  flag: string;
  legacyFlags?: string[];
  requiredEnv: readonly string[];
}

export interface ProviderSmokeConfig {
  provider: RealSmokeProvider;
  requested: boolean;
  missingEnv: string[];
}

const masterFlag = 'DASK_REAL_SMOKE';
const releaseFlag = 'DASK_RELEASE_REAL_SMOKE';

export const providerSmokeDefinitions: Record<RealSmokeProvider, ProviderSmokeDefinition> = {
  stripePlatform: {
    name: 'Stripe Platform',
    flag: 'DASK_REAL_SMOKE_STRIPE_PLATFORM',
    legacyFlags: ['DASK_STRIPE_REAL_SMOKE'],
    requiredEnv: [
      'STRIPE_ENVIRONMENT',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLIC_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'BILLING_PORTAL_TOKEN_SECRET',
      'STRIPE_PRICE_ID_PERSONAL_MONTHLY',
      'STRIPE_PRICE_ID_BUSINESS_MONTHLY'
    ]
  },
  stripeConnect: {
    name: 'Stripe Connect',
    flag: 'DASK_REAL_SMOKE_STRIPE_CONNECT',
    requiredEnv: [
      'STRIPE_SECRET_KEY',
      'DASK_STRIPE_CONNECT_ACCOUNT_ID',
      'DASK_STRIPE_CONNECT_REQUIRED_CAPABILITIES'
    ]
  },
  focusFiscal: {
    name: 'Focus Fiscal',
    flag: 'DASK_REAL_SMOKE_FOCUS',
    requiredEnv: [
      'FOCUS_API_ENVIRONMENT',
      'FOCUS_API_BASE_URL',
      'DASK_FOCUS_SMOKE_TOKEN',
      'DASK_FOCUS_SMOKE_CNPJ',
      'DASK_FOCUS_SMOKE_ENVIRONMENT'
    ]
  },
  aiProvider: {
    name: 'AI Provider',
    flag: 'DASK_REAL_SMOKE_AI',
    requiredEnv: [
      'OPENAI_API_KEY',
      'OPENAI_BASE_URL',
      'AI_CHAT_MODEL'
    ]
  }
};

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function readBoolean(value: string | undefined): boolean {
  if (!hasValue(value)) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isProviderSmokeRequested(provider: RealSmokeProvider, env: SmokeEnv = process.env): boolean {
  const definition = providerSmokeDefinitions[provider];
  return readBoolean(env[masterFlag]) ||
    readBoolean(env[releaseFlag]) ||
    readBoolean(env[definition.flag]) ||
    Boolean(definition.legacyFlags?.some((flag) => readBoolean(env[flag])));
}

export function readProviderSmokeConfig(provider: RealSmokeProvider, env: SmokeEnv = process.env): ProviderSmokeConfig {
  const definition = providerSmokeDefinitions[provider];
  const requested = isProviderSmokeRequested(provider, env);
  const missingEnv = requested ? definition.requiredEnv.filter((key) => !hasValue(env[key])) : [];

  return {
    provider,
    requested,
    missingEnv
  };
}

export function requireCompleteProviderSmokeEnv(provider: RealSmokeProvider, env: SmokeEnv = process.env): void {
  const config = readProviderSmokeConfig(provider, env);
  if (!config.requested || config.missingEnv.length === 0) {
    return;
  }

  throw new Error(`${providerSmokeDefinitions[provider].name} real smoke env is incomplete. Missing: ${config.missingEnv.join(', ')}`);
}

export function readEnvValue(key: string, env: SmokeEnv = process.env): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required smoke env ${key}`);
  }
  return value;
}

export function parseCsvEnv(key: string, fallback: string[], env: SmokeEnv = process.env): string[] {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }

  return Array.from(new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean)));
}

export function assertStripeSmokeKeyIsSafe(secretKey: string, env: SmokeEnv = process.env): void {
  if (secretKey.startsWith('sk_test_')) {
    return;
  }

  if (readBoolean(env.DASK_REAL_SMOKE_ALLOW_LIVE_STRIPE)) {
    return;
  }

  throw new Error('Stripe real smoke refuses live or unknown secret keys unless DASK_REAL_SMOKE_ALLOW_LIVE_STRIPE=true.');
}

export function assertFocusSmokeEnvironmentIsSafe(environment: string, env: SmokeEnv = process.env): void {
  if (environment === 'homologacao') {
    return;
  }

  if (readBoolean(env.DASK_REAL_SMOKE_ALLOW_FOCUS_PRODUCTION)) {
    return;
  }

  throw new Error('Focus real smoke refuses non-homologacao environments unless DASK_REAL_SMOKE_ALLOW_FOCUS_PRODUCTION=true.');
}

export function formatSmokeError(error: unknown): string {
  return redactErrorMessage(error, 1200);
}

export function redactSmokeDetails<T>(value: T): T {
  return redactSensitiveValue(value, { maskPersonalData: true, maxStringLength: 500 });
}
