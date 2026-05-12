# Dask API

Backend do Dask em monolito modular, com Node.js, Express e TypeScript.

## Stack

- Node.js
- Express
- TypeScript strict
- Prisma + PostgreSQL
- Redis + BullMQ
- Zod
- Vitest (testes unitarios)

## Estrutura

```txt
dask-api/
|-- prisma/
|-- src/
|   |-- core/
|   |-- infra/
|   |-- modules/
|-- package.json
```

## Setup local

1. Copie `.env.example` para `.env`.
2. Suba PostgreSQL e Redis a partir da raiz do monorepo:

```bash
npm run infra:up
```

3. Instale dependencias:

```bash
npm install
```

4. Gere Prisma Client e aplique schema:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Rode a API:

```bash
npm run dev
```

Healthcheck: `GET /health`

## Scripts padrao

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run check`

## Endpoints principais

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/organizations`
- `POST /api/v1/workspaces`
- `POST /api/v1/boards`
- `POST /api/v1/templates`
- `POST /api/v1/items`
- `PATCH /api/v1/items/:itemId`
- `POST /api/v1/items/:itemId/ai/improve-description`
- `POST /api/v1/items/:itemId/search/index`
- `GET /api/v1/search?q=bug&workspaceId=<uuid>`
- `POST /api/v1/automation/rules`
- `POST /api/v1/automation/rules/:ruleId/run`
- `POST /api/v1/integration/webhooks`
- `POST /api/v1/integrations/commercial-intake/webhook/:source`
- `GET /api/v1/audit/events`

## Commercial intake webhooks

- Configure `COMMERCIAL_INTAKE_WEBHOOK_SECRET` in production. Requests without an accepted secret or signature are rejected.
- Accepted auth: `Authorization: Bearer <secret>`, `X-Commercial-Intake-Secret`, `X-Comercial-Webhook-Secret`, `X-Webhook-Secret`, or HMAC SHA-256 signature in `X-Dask-Signature`.
- `COMMERCIAL_INTAKE_WEBHOOK_ALLOW_INSECURE=true` is only for explicit local dev/test runs without a secret.
- Intake metadata stores technical trace data and sanitized summaries only; raw inbound payload values are not persisted.

## Provider webhooks

- `MARKETING_WEBHOOK_SECRET` is required in production for `/integrations/marketing/email-events/:provider`.
- If `RESEND_WEBHOOK_ENABLED=true` in production, `RESEND_WEBHOOK_SECRET` is required and every request must be signed.
- If `META_WHATSAPP_WEBHOOK_ENABLED=true` in production, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `META_WHATSAPP_WEBHOOK_APP_SECRET` are required.

## Stripe Billing e Connect

- Production fails startup when Billing/Fiscal config is missing, partial, weak, or points to sandbox providers.
- Production requires `STRIPE_ENVIRONMENT=live`, `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_PUBLIC_KEY=pk_live_...`, `STRIPE_WEBHOOK_SECRET`, `BILLING_PORTAL_TOKEN_SECRET`, `STRIPE_PRICE_ID_PERSONAL_MONTHLY`, `STRIPE_PRICE_ID_BUSINESS_MONTHLY`, `STRIPE_CONNECT_APPLICATION_FEE_BPS`, and `STRIPE_CONNECT_REQUIRED_CAPABILITIES`.
- Production Focus requires `FOCUS_API_ENVIRONMENT=producao`, explicit `FOCUS_API_BASE_URL`, and strong `FOCUS_WEBHOOK_SECRET`.
- Dev/test may omit provider envs and use mocks; set an explicit local-only `BILLING_PORTAL_TOKEN_SECRET` only when exercising portal links.
- Billing portal tokens are signed, hashed at rest, expire, and are not stored as raw URLs in order metadata.
- Stripe webhooks require the `stripe-signature` header and are validated with `STRIPE_WEBHOOK_SECRET`.
- Connect checkout validates `charges_enabled`, `transfers`, and the payment method capabilities before creating a payment session.
- Optional real provider smokes live outside the unit-test glob. See `docs/real-integration-smokes.md` and run `npm run test:integration:real` only with complete staging/sandbox envs.

## Testes unitarios

- Runner: `Vitest`
- Convencao: `*.spec.ts`
- Exemplo: `src/modules/ai/application/prompt-orchestration-service.spec.ts`

## Notas arquiteturais

- Modulos por dominio para baixo acoplamento.
- Eventos internos + outbox inicial para evolucao.
- JSONB para customizacao (`schema`, `rules`, `fields`, `metadata`, `config`, `permissions`).
- Preparado para busca semantica com `pgvector`.
