import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import {
  assertFocusSmokeEnvironmentIsSafe,
  assertStripeSmokeKeyIsSafe,
  formatSmokeError,
  parseCsvEnv,
  providerSmokeDefinitions,
  readEnvValue,
  readProviderSmokeConfig,
  redactSmokeDetails,
  requireCompleteProviderSmokeEnv
} from '../helpers/real-smoke-env';

function describeProvider(provider: keyof typeof providerSmokeDefinitions) {
  return readProviderSmokeConfig(provider).requested ? describe : describe.skip;
}

async function runRedactedStep(name: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
    console.info(`[real-smoke] ${name}: passed`);
  } catch (error) {
    throw new Error(`[real-smoke] ${name}: ${formatSmokeError(error)}`);
  }
}

describeProvider('stripePlatform')('Stripe Platform real smoke', () => {
  it('retrieves configured platform prices without creating payments', async () => {
    await runRedactedStep('stripe-platform.prices.retrieve', async () => {
      requireCompleteProviderSmokeEnv('stripePlatform');
      const secretKey = readEnvValue('STRIPE_SECRET_KEY');
      const publicKey = readEnvValue('STRIPE_PUBLIC_KEY');
      assertStripeSmokeKeyIsSafe(secretKey);
      expect(publicKey.startsWith(secretKey.startsWith('sk_live_') ? 'pk_live_' : 'pk_test_')).toBe(true);

      const stripe = new Stripe(secretKey);
      const [personalPrice, businessPrice] = await Promise.all([
        stripe.prices.retrieve(readEnvValue('STRIPE_PRICE_ID_PERSONAL_MONTHLY')),
        stripe.prices.retrieve(readEnvValue('STRIPE_PRICE_ID_BUSINESS_MONTHLY'))
      ]);

      expect(personalPrice.active).toBe(true);
      expect(businessPrice.active).toBe(true);
      expect(personalPrice.id).toBe(readEnvValue('STRIPE_PRICE_ID_PERSONAL_MONTHLY'));
      expect(businessPrice.id).toBe(readEnvValue('STRIPE_PRICE_ID_BUSINESS_MONTHLY'));
      if (secretKey.startsWith('sk_test_')) {
        expect(personalPrice.livemode).toBe(false);
        expect(businessPrice.livemode).toBe(false);
      }
    });
  }, 30_000);
});

describeProvider('stripeConnect')('Stripe Connect real smoke', () => {
  it('retrieves a connected account and validates required capabilities without creating charges', async () => {
    await runRedactedStep('stripe-connect.accounts.retrieve', async () => {
      requireCompleteProviderSmokeEnv('stripeConnect');
      const secretKey = readEnvValue('STRIPE_SECRET_KEY');
      assertStripeSmokeKeyIsSafe(secretKey);

      const stripe = new Stripe(secretKey);
      const account = await stripe.accounts.retrieve(readEnvValue('DASK_STRIPE_CONNECT_ACCOUNT_ID'));
      const requiredCapabilities = parseCsvEnv('DASK_STRIPE_CONNECT_REQUIRED_CAPABILITIES', [
        'charges_enabled',
        'transfers',
        'card_payments'
      ]);

      const missing = requiredCapabilities.filter((capability) => {
        if (capability === 'charges_enabled') return account.charges_enabled !== true;
        return account.capabilities?.[capability] !== 'active';
      });

      expect(account.id).toBe(readEnvValue('DASK_STRIPE_CONNECT_ACCOUNT_ID'));
      if (secretKey.startsWith('sk_test_')) {
        expect(account.livemode).toBe(false);
      }
      expect(missing).toEqual([]);
    });
  }, 30_000);
});

describeProvider('focusFiscal')('Focus Fiscal real smoke', () => {
  it('validates a homologacao fiscal company config without issuing documents', async () => {
    await runRedactedStep('focus-fiscal.company.validate', async () => {
      requireCompleteProviderSmokeEnv('focusFiscal');
      const environment = readEnvValue('DASK_FOCUS_SMOKE_ENVIRONMENT');
      assertFocusSmokeEnvironmentIsSafe(environment);

      const { FocusFiscalProvider } = await import('@/modules/fiscal/providers/focus/focus-fiscal-provider');
      const provider = new FocusFiscalProvider({
        baseUrl: readEnvValue('FOCUS_API_BASE_URL'),
        environment: 'test',
        providerEnvironment: readEnvValue('FOCUS_API_ENVIRONMENT') as 'homologacao' | 'producao',
        isBaseUrlExplicit: true,
        requireExplicitBaseUrl: true
      });

      const result = await provider.validateCompanyConfig({
        company: {
          id: 'real-smoke-focus',
          cnpj: readEnvValue('DASK_FOCUS_SMOKE_CNPJ'),
          token: readEnvValue('DASK_FOCUS_SMOKE_TOKEN'),
          environment
        }
      });

      if (!result.ok) {
        throw new Error(`Focus validation failed: ${JSON.stringify(redactSmokeDetails(result.details))}`);
      }

      expect(result.ok).toBe(true);
    });
  }, 45_000);
});

describeProvider('aiProvider')('AI provider real smoke', () => {
  it('generates a short response through the configured provider without logging prompts or secrets', async () => {
    await runRedactedStep('ai-provider.responses.generate', async () => {
      requireCompleteProviderSmokeEnv('aiProvider');

      const { OpenAIAIProvider } = await import('@/infra/providers/ai/openai-ai-provider');
      const provider = new OpenAIAIProvider();
      const result = await provider.generateText({
        model: readEnvValue('AI_CHAT_MODEL'),
        systemPrompt: 'You are running a Dask provider smoke. Reply with a short non-sensitive acknowledgement.',
        userPrompt: 'Return the word OK and nothing else.',
        temperature: 0
      });

      expect(result.provider).toBe('openai');
      expect(result.content.trim().length).toBeGreaterThan(0);
    });
  }, 45_000);
});
