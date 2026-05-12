# Marketing Module (Operational Continuity)

## Vision

Marketing is not an isolated sender.  
Inside Dask, marketing is a native operational layer where the same context crosses:

- commercial signal capture and qualification
- nurturing and campaign engagement
- commercial follow-up
- onboarding and retention
- billing and renewal signals
- timeline and long-term organizational memory

This module follows the product thesis:

> Do signal ao faturamento, do escopo a execucao, do conhecimento a operacao - tudo no mesmo contexto.

## Architecture

### Backend stack

- Node.js + Express + TypeScript
- Prisma + PostgreSQL
- Redis + BullMQ (`marketing.send-email`)
- Domain events via outbox
- AI provider abstraction for campaign generation/improvement
- Email provider abstraction (`MarketingEmailProvider`) for multi-provider future

### Module boundaries

- HTTP routes: `src/modules/marketing/http/routes.ts`
- Integration webhooks: `src/modules/marketing/http/integration-routes.ts`
- Application service: `src/modules/marketing/application/marketing-service.ts`
- Repository contract + Prisma adapter:
  - `src/modules/marketing/repositories/marketing-repository.ts`
  - `src/modules/marketing/repositories/prisma-marketing-repository.ts`
- Provider layer:
  - `src/modules/marketing/providers/marketing-email-provider.ts`
  - `src/modules/marketing/providers/resend-marketing-email-provider.ts`
  - `src/modules/marketing/providers/mock-marketing-email-provider.ts`

### Frontend stack

- React + Vite + TypeScript
- Module client:
  - `dask-app/src/modules/marketing/api/marketing-service.ts`
- Marketing page:
  - `dask-app/src/pages/marketing-page/ui/marketing-page.tsx`

## Data model

Primary tables:

- `MarketingCampaign`
- `MarketingCampaignVariant`
- `MarketingAudienceSegment`
- `MarketingContactPreference`
- `MarketingEmailTemplate`
- `MarketingSenderProfile`
- `MarketingCampaignSend`
- `MarketingAutomationFlow`
- `MarketingAutomationStep`
- `MarketingAutomationEnrollment`
- `MarketingEvent`
- `MarketingLeadScoreEvent` (historical/compatibility table; active score signals use `MarketingEvent.itemId`)
- `MarketingAttribution`
- `MarketingConsentRecord`
- `MarketingContentAsset`

### Continuity-first relations

Marketing entities are workspace-scoped and connected to existing context:

- `Item` / WorkItem (commercial contact context, score, engagement, follow-ups, activity timeline)
- `Customer` (customer registry and customer-level continuity)
- `WorkspaceDocument` (context for AI generation)
- billing user/subscription status (segment evaluation enrichment)
- workspace governance (module entitlements and permissions)

No parallel contact model is created. Marketing derives contact context from commercial WorkItems and links customer context through `Customer`.

## Operational flows

### Campaign lifecycle

1. Create (`DRAFT`)
2. Submit review (`IN_REVIEW`)
3. Approve (`APPROVED`)
4. Schedule (`SCHEDULED`) or launch (`ACTIVE`)
5. Track events and score impact
6. Pause/complete/archive as needed

### Send pipeline

1. Audience resolution from dynamic segment filters
2. Consent/preference validation (`OPT_OUT`, `UNSUBSCRIBED` respected)
3. Variant selection (weighted A/B)
4. Personalized rendering (`{{contact.*}}` tokens render the commercial WorkItem contact)
5. Idempotent send creation + queue job
6. Worker provider dispatch
7. Provider webhooks -> event normalization
8. Timeline + score + attribution updates

### AI-assisted flow

- Generate campaign from objective + workspace docs + stage/tone hints
- Create A/B variants
- Persist AI metadata (`aiGenerated`, context payload)
- Improve existing variant with AI while preserving human editing control

## Integrations

### Commercial CRM

- Campaign events create WorkItem history
- Scoring is explainable via `MarketingEvent.itemId` and WorkItem field updates
- Engagement signals can guide next stage decisions

### Billing

- Segment filters support billing status enrichment (`billing_status`)
- Supports billing reminders, renewal, expansion and reactivation motions

### Documentation

- AI generation consumes recent workspace docs to produce context-aware campaigns

### Timeline / history

- Relevant actions emit `MarketingEvent`
- Campaign + WorkItem/customer context retains traceability across lifecycle

### Automation engine

- Marketing flows (`MarketingAutomationFlow`, steps, enrollments) are available
- Campaign launch and commercial score events are published to domain events

## Security, governance and compliance

### Multi-workspace isolation

- All marketing entities are scoped by `workspaceId`
- Workspace module gating requires `marketing` module entitlement

### Permissions

Implemented permission keys:

- `marketing.view`
- `marketing.campaign.create`
- `marketing.campaign.approve`
- `marketing.campaign.send`
- `marketing.template.manage`
- `marketing.segment.manage`
- `marketing.analytics.view`
- `marketing.sender.manage`
- `marketing.automation.manage`
- `marketing.ai.use`
- `marketing.integration`

### Compliance foundations (LGPD-ready)

- Contact preferences and consent records
- Distinction of message kind and consent state
- Unsubscribe and opt-out respected during audience evaluation
- Webhook secret support (`MARKETING_WEBHOOK_SECRET`), required in production for provider event intake

## API surface (phase foundation)

Workspace routes:

- `GET /marketing/workspaces/:workspaceId/dashboard`
- `GET /marketing/workspaces/:workspaceId/campaigns`
- `POST /marketing/workspaces/:workspaceId/campaigns`
- `GET /marketing/workspaces/:workspaceId/campaigns/:campaignId`
- `PATCH /marketing/workspaces/:workspaceId/campaigns/:campaignId`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/submit-review`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/approve`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/schedule`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/send-test`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/launch`
- `GET /marketing/workspaces/:workspaceId/campaigns/:campaignId/analytics`
- `GET /marketing/workspaces/:workspaceId/audience/contacts`
- `GET /marketing/workspaces/:workspaceId/audience/segments`
- `POST /marketing/workspaces/:workspaceId/audience/segments`
- `PATCH /marketing/workspaces/:workspaceId/audience/segments/:segmentId`
- `POST /marketing/workspaces/:workspaceId/audience/segments/:segmentId/preview`
- `GET /marketing/workspaces/:workspaceId/templates`
- `POST /marketing/workspaces/:workspaceId/templates`
- `PATCH /marketing/workspaces/:workspaceId/templates/:templateId`
- `GET /marketing/workspaces/:workspaceId/automations/flows`
- `POST /marketing/workspaces/:workspaceId/automations/flows`
- `POST /marketing/workspaces/:workspaceId/ai/generate-campaign`
- `POST /marketing/workspaces/:workspaceId/campaigns/:campaignId/variants/:variantId/ai-improve`

Integration routes:

- `POST /integrations/marketing/email-events/:provider`

## Phase status

### Phase 1 (implemented foundation)

- Core schema and relationships
- Campaign management and lifecycle
- Email/newsletter variant support
- Test send and batch queue send
- Audience and dynamic segments
- Templates library foundation
- AI generation and AI content improvement
- Commercial WorkItem score explainability/events
- Timeline/event persistence
- Marketing dashboard and initial analytics

### Phase 2 (next)

- Visual automation builder with branches/delays
- Advanced scoring and stage recommendations
- Deeper analytics and A/B comparison
- Editorial calendar evolution
- Stronger CRM and billing triggers

### Phase 3 (next)

- Attribution model evolution
- Complex multi-journey orchestration
- Advanced AI optimization loops
- Fine-grained governance and policy controls

## Known limitations (current increment)

- Provider implementation currently optimized for initial provider set; multi-provider orchestration is prepared, not complete.
- Billing enrichment currently uses user subscription signals; deeper invoice/charge-level joins can be expanded.
- Automation builder is foundation-level and not yet a full node-graph editor.
- Attribution model exists structurally and requires deeper weighting rules in future increments.
