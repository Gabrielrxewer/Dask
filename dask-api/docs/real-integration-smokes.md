# Real integration smokes

These smokes are optional and are not part of `npm run test`. They call real providers and should run only against staging, sandbox or homologation accounts.

Run:

```bash
npm run test:integration:real
```

With no provider flags, the smoke file is skipped. When a provider flag is enabled, its env must be complete; partial env fails the smoke.

## Common flags

- `DASK_REAL_SMOKE=true`: enables every real provider smoke.
- `DASK_RELEASE_REAL_SMOKE=true`: release/staging gate flag; enables every real provider smoke and fails if any required env is missing.
- Prefer provider-specific flags when validating one integration at a time.
- `DASK_REAL_SMOKE_ALLOW_LIVE_STRIPE=true`: allows live Stripe keys. Default is blocked.
- `DASK_REAL_SMOKE_ALLOW_FOCUS_PRODUCTION=true`: allows Focus `producao`. Default is blocked.

## Stripe Platform

Enable with `DASK_REAL_SMOKE_STRIPE_PLATFORM=true`.

Required env:

- `STRIPE_ENVIRONMENT`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLIC_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BILLING_PORTAL_TOKEN_SECRET`
- `STRIPE_PRICE_ID_PERSONAL_MONTHLY`
- `STRIPE_PRICE_ID_BUSINESS_MONTHLY`

The smoke only retrieves configured prices. It does not create customers, sessions, charges, subscriptions or refunds. By default it requires `sk_test_` keys.

`DASK_STRIPE_REAL_SMOKE=true` remains supported as a legacy alias for this smoke.

## Stripe Connect

Enable with `DASK_REAL_SMOKE_STRIPE_CONNECT=true`.

Required env:

- `STRIPE_SECRET_KEY`
- `DASK_STRIPE_CONNECT_ACCOUNT_ID`
- `DASK_STRIPE_CONNECT_REQUIRED_CAPABILITIES`

The smoke only retrieves the connected account and checks capabilities. It does not create account links, checkout sessions, payment intents, transfers or charges.

## Focus Fiscal

Enable with `DASK_REAL_SMOKE_FOCUS=true`.

Required env:

- `FOCUS_API_ENVIRONMENT`
- `FOCUS_API_BASE_URL`
- `DASK_FOCUS_SMOKE_TOKEN`
- `DASK_FOCUS_SMOKE_CNPJ`
- `DASK_FOCUS_SMOKE_ENVIRONMENT=homologacao`

The smoke calls the provider config validation path only. It does not register companies, issue documents, cancel documents or sync fiscal documents. `producao` is blocked unless `DASK_REAL_SMOKE_ALLOW_FOCUS_PRODUCTION=true`.

## AI provider

Enable with `DASK_REAL_SMOKE_AI=true`.

Required env:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `AI_CHAT_MODEL`

The smoke sends a short non-sensitive prompt and asserts a non-empty response. Provider errors and smoke failure messages are redacted before being printed.

## CI policy

Use `npm run test` and `npm run typecheck` for local and CI unit checks. Use `npm run test:integration:real` in a protected staging job with secrets injected by the CI environment.

For release/staging:

```bash
DASK_RELEASE_REAL_SMOKE=true npm run test:integration:real
```

This command must run only in a protected environment that has sandbox/test Stripe, Focus homologation and AI provider secrets injected. The smoke logs only provider step names and redacted failure messages; API keys, bearer tokens, portal tokens, webhook secrets, sensitive payload fields and prompts are redacted.
