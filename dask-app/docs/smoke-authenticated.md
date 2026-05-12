# Authenticated Smoke

This smoke validates the authenticated HTTP contracts used by Billing, Fiscal and AI Agents without storing real credentials in the repository.

## Commands

Run from `dask-app`:

```bash
npm run smoke:authenticated
```

The local command reuses Vitest. When credentials are missing it prints setup guidance and exits without calling external systems.

Release/staging gates must use the strict command:

```bash
npm run smoke:authenticated:release
```

The release command sets `DASK_RELEASE_SMOKE=1`. In this mode missing required env fails the test, and any smoke step reported as `skipped` or `environment_gap` fails the gate instead of producing a false positive. `npm run check:release` runs `typecheck`, unit tests and the release smoke gate.

The authenticated release smoke validates login, workspace resolution, Dashboard, List, Agenda, Board, Marketing, Marketing Journey flows, Automation, Documentation, Billing, Fiscal and AI contract surfaces.

## Required Environment

```bash
DASK_SMOKE_API_URL=http://localhost:3333/api/v1
DASK_SMOKE_BASE_URL=http://localhost:5173
DASK_SMOKE_EMAIL=dev@example.com
DASK_SMOKE_PASSWORD=replace-with-local-password
DASK_SMOKE_WORKSPACE_SLUG=my-workspace
# or
DASK_SMOKE_WORKSPACE_ID=00000000-0000-0000-0000-000000000000
```

`DASK_SMOKE_BASE_URL` and `DASK_SMOKE_API_URL` have localhost defaults only for local mode. They are mandatory in release mode so the gate cannot accidentally validate the wrong target.

Do not commit real `.env` files, tokens or captured sessions. The smoke logs only high-level step status and does not print prompts, provider outputs or secrets.

## Optional Flags

```bash
DASK_SMOKE_RUN_EXTERNALS=false
DASK_SMOKE_SKIP_STRIPE=false
DASK_SMOKE_SKIP_FOCUS=false
DASK_SMOKE_SKIP_AI=false
DASK_SMOKE_CREATE_FISCAL_COMPANY=false
DASK_SMOKE_CREATE_FISCAL_DRAFT=false
DASK_SMOKE_FOCUS_TOKEN=replace-with-focus-homolog-token
DASK_SMOKE_FISCAL_COMPANY_ID=00000000-0000-0000-0000-000000000000
```

`DASK_SMOKE_RUN_EXTERNALS=true` enables calls that may reach Stripe Connect, Focus or AI runtime/provider paths. Keep it false for routine local contract checks unless the external test accounts are configured.

For release/staging, keep skip flags false and provide an environment that can complete all required smoke steps. The gate fails if a skip flag or missing required setup causes a `skipped` result. Optional destructive or external-provider paths remain opt-in and are reported as non-destructive release policy notes unless their env flags enable them.

## Release Evidence

The smoke logs one line per step with only flow, step name, outcome and HTTP status/message. It never logs `DASK_SMOKE_PASSWORD`, bearer tokens, refresh tokens, portal tokens or provider secrets.

Core read-only release coverage:

- `auth`: login and `/auth/me`;
- `workspace`: list, resolve and profile load;
- `dashboard`: overview and widgets;
- `board`: workspace snapshot;
- `list`: paged work items;
- `agenda`: planned work item window;
- `marketing`: dashboard, campaigns and automation flows;
- `automation`: capabilities, workflows and runs;
- `documentation`: documents and folders;
- `billing`: status, plans, Connect catalog/account and safe `SMOKE_` catalog lifecycle when Connect allows it;
- `fiscal`: dashboard, companies, documents, received documents, drafts and sync runs;
- `ai`: capabilities, agent lifecycle with `SMOKE_` marker and archive cleanup.

## Local Auth Model

The browser app logs in through `POST /auth/login`. The API returns an `accessToken` and also sets refresh/CSRF cookies for browser refresh flows. The smoke uses the returned bearer token for authenticated requests, so it does not need to persist browser storage or cookie sessions.

The smoke workspace is resolved by `DASK_SMOKE_WORKSPACE_ID` first. If only `DASK_SMOKE_WORKSPACE_SLUG` is provided, it calls `GET /workspaces` and computes the same slug style used by the front-end workspace service.

## Billing Coverage

The Billing smoke validates:

- platform subscription status;
- plan catalog;
- Connect account status;
- Connect catalog page shape and cursor pagination;
- create, update and archive a `SMOKE_` catalog item when Connect allows it;
- payment orders page shape;
- checkout, post-checkout sync, boleto capability request, resend e-mail and portal token when the Connect environment allows them.

Stripe/Connect responses such as missing account, missing capability, or not configured account are reported as `environment_gap`. HTTP 500 or incompatible payload shapes are reported as real failures.

## Fiscal Coverage

The Fiscal smoke validates:

- dashboard shape;
- companies page shape;
- issued documents with `pageSize` and optional `nextCursor`;
- received documents with `pageSize`;
- Stripe drafts with `pageSize`;
- sync runs with `pageSize`;
- company validation when a company id exists;
- optional `SMOKE_` company/document creation only when explicitly enabled.

Focus calls for issue/retry/sync require `DASK_SMOKE_RUN_EXTERNALS=true`, `DASK_SMOKE_SKIP_FOCUS=false`, valid backend `FOCUS_API_BASE_URL`, and a valid Focus homolog token/company. Focus `401` and `404` in that mode usually mean invalid token, wrong environment, or a company/reference that does not exist in the selected Focus base.

Fiscal company creation defaults the smoke payload to `stripePolicy=manual_review`.

## AI Coverage

The AI smoke validates:

- capabilities;
- list agents;
- create `SMOKE_` agent;
- update agent;
- validate runtime graph;
- invalid config rejection;
- publish agent to Automation Runtime;
- optional run when externals are enabled;
- list runs;
- archive the created agent.

If Automation Runtime or an AI provider is unavailable, provider/runtime responses are reported as `environment_gap` when the status/message indicates configuration. Contract shape mismatches and server errors remain failures.

## External Setup Notes

Stripe Connect test validation requires:

- backend `STRIPE_SECRET_KEY`;
- Stripe products/prices for platform subscription if exercising plan checkout;
- a Connect account attached to the smoke workspace;
- requested local payment capabilities available in the Stripe test account;
- `APP_PUBLIC_URL`/`API_PUBLIC_URL` aligned with the local origin if redirects/webhooks are tested.

Focus homologation validation requires:

- backend `FOCUS_API_BASE_URL` pointing to the intended Focus environment;
- a valid Focus token stored only in env or in a test fiscal company config;
- a smoke fiscal company id or explicit smoke company creation;
- `DASK_SMOKE_RUN_EXTERNALS=true` only when the homolog account is ready.

AI runtime validation requires:

- workspace permissions for `ai.use`, `ai.configure`, `automation.workflows.publish`, and runtime execution if running;
- Automation Runtime services configured;
- provider env such as `OPENAI_API_KEY` only when real provider execution is expected.

## Interpreting Common Results

- `401` on login: wrong smoke credentials or unverified local user.
- `401` after login: token expired, auth middleware rejected the session, or the user lacks verified e-mail.
- Redirect to login in visual smoke: front and API origins/cookies are not aligned.
- `409` or `422` in Connect: account/capability/workspace Connect setup is incomplete unless payload shape is clearly invalid.
- Focus `401`: invalid token or mismatched Focus environment.
- Focus `404`: company/reference does not exist in that Focus base.
- AI `503`: runtime/provider not configured.

## Cleanup

Billing catalog items created by the smoke are archived in the same run. AI agents created by the smoke are archived in the same run. Fiscal document/company creation is off by default because those records may be audit-relevant; when enabled, search for `SMOKE_` and clean according to the environment policy.

## Remaining Direct Calls

Low-risk Billing calls migrated to query/mutation hooks in this phase:

- `billing-success-page`;
- `choose-plan-page`;
- `global-layout`;
- `settings/general-settings`;
- `use-workspace-task-page`.

Route aliases:

- `/w/:workspaceSlug/leads` is kept only as a product/URL alias redirecting to `/w/:workspaceSlug/commercial`. The active frontend domain is `modules/commercial` over WorkItem/Customer/Signal, not `modules/leads`.

No direct Fiscal or AI service calls were found outside their query modules and service layers in the scoped files.
