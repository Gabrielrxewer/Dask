import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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
  APP_URL: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.string().default('info'),
  ENABLE_WORKERS: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  OUTBOX_RELAY_INTERVAL_MS: z.coerce.number().int().min(100).default(1000),
  OUTBOX_RELAY_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  OUTBOX_RELAY_MAX_RETRIES: z.coerce.number().int().min(1).max(1000).default(20),

  // Stripe Billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PERSONAL_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_BUSINESS_MONTHLY: z.string().optional(),
  APP_PUBLIC_URL: z.string().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().default('http://localhost:3333')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
