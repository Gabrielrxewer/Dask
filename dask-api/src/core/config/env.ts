import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LOG_LEVEL_VALUES = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;

const logLevelSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(LOG_LEVEL_VALUES).default('info')
);

const logPrettySchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['auto', 'always', 'never']).default('auto')
);

const debugChannelsSchema = z
  .string()
  .default('')
  .transform((raw) =>
    Array.from(
      new Set(
        raw
          .split(',')
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
      )
    )
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  HASH_PEPPER: z.string().min(32),
  AUTH_MAX_FAILURES: z.coerce.number().int().min(1).default(5),

  // Comma-separated allowlist, no wildcard.
  CORS_ALLOWED_ORIGINS: z.string().min(1),

  // Secret used to sign double-submit CSRF tokens.
  CSRF_SECRET: z.string().min(32),

  // strict | lax | none
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  // OAuth / OIDC (social login)
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_ID: z.string().optional(),
  MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_OAUTH_TENANT_ID: z.string().default('common'),
  MICROSOFT_OAUTH_REDIRECT_URI: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Dask <noreply@dask.app>'),
  RESEND_DEFAULT_FROM: z.string().optional(),
  RESEND_REPLY_TO: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_WEBHOOK_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  COMMUNICATION_DEFAULT_PHONE_COUNTRY: z.string().default('BR'),
  COMMUNICATION_DEFAULT_PHONE_DDI: z.string().default('55'),
  AUTOMATION_EMAIL_SEND_MODE: z.enum(['mock', 'real']).default('mock'),
  AUTOMATION_EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_WHATSAPP_WEBHOOK_APP_SECRET: z.string().optional(),
  META_WHATSAPP_WEBHOOK_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  APP_URL: z.string().default('http://localhost:5173'),

  LOG_LEVEL: logLevelSchema,
  LOG_PRETTY: logPrettySchema,
  LOG_DEBUG_CHANNELS: debugChannelsSchema,
  LOG_DB_QUERY_MIN_DURATION_MS: z.coerce.number().int().min(0).default(10),
  LOG_DB_QUERY_INCLUDE_TX_CONTROL: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  LOG_DB_QUERY_INCLUDE_OUTBOX_POLL: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  ENABLE_WORKERS: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  OUTBOX_RELAY_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  OUTBOX_RELAY_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  OUTBOX_RELAY_MAX_RETRIES: z.coerce.number().int().min(1).max(1000).default(20),
  AUTOMATION_SCHEDULED_STEP_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  AUTOMATION_SCHEDULED_STEP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  AUTOMATION_SIDE_EFFECT_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  AUTOMATION_SIDE_EFFECT_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),

  // Stripe Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_SECRET_FISCAL: z.string().optional(),
  STRIPE_PRICE_ID_PERSONAL_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_CONNECT_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  FOCUS_API_BASE_URL: z.string().default('https://api.focusnfe.com.br/v2'),
  FOCUS_WEBHOOK_SECRET: z.string().optional(),
  LEADS_WEBHOOK_SECRET: z.string().optional(),
  MARKETING_WEBHOOK_SECRET: z.string().optional(),
  APP_PUBLIC_URL: z.string().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().default('http://localhost:3333'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_CHAT_MODEL: z.string().default('gpt-4.1-mini'),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
  AI_MAX_REQUESTS_PER_MIN_WORKSPACE: z.coerce.number().int().min(1).default(120),
  AI_MAX_REQUESTS_PER_MIN_AGENT: z.coerce.number().int().min(1).default(40),
  AI_MAX_TOKENS_PER_DAY_WORKSPACE: z.coerce.number().int().min(1000).default(2_500_000),
  AI_MAX_TOKENS_PER_DAY_AGENT: z.coerce.number().int().min(1000).default(900_000),
  AI_EMBEDDING_CHUNK_SIZE: z.coerce.number().int().min(100).max(4000).default(900),
  AI_EMBEDDING_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(1000).default(140),
  AI_EMBEDDING_VERSION: z.string().default('v1')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
