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
- `GET /api/v1/audit/events`

## Testes unitarios

- Runner: `Vitest`
- Convencao: `*.spec.ts`
- Exemplo: `src/modules/ai/application/prompt-orchestration-service.spec.ts`

## Notas arquiteturais

- Modulos por dominio para baixo acoplamento.
- Eventos internos + outbox inicial para evolucao.
- JSONB para customizacao (`schema`, `rules`, `fields`, `metadata`, `config`, `permissions`).
- Preparado para busca semantica com `pgvector`.
