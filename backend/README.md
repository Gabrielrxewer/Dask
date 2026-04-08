# Dask Backend (Monólito Modular)

Base inicial do backend do Dask com `Node.js + Express + TypeScript`, organizada por domínios e preparada para evolução incremental.

## Stack

- Node.js
- Express
- TypeScript (strict)
- Prisma + PostgreSQL
- Redis + BullMQ
- Zod (validação)

## Rodando localmente

1. Copie `.env.example` para `.env`.
2. Suba infraestrutura:

```bash
docker compose up -d
```

3. Instale dependências:

```bash
npm install
```

4. Gere o client Prisma e aplique schema:

```bash
npm run prisma:generate
npm run prisma:push
```

5. Rode a API:

```bash
npm run dev
```

Healthcheck: `GET /health`

## Endpoints base

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

## Observações de modelagem

- Estrutura relacional no core (usuários, organizações, workspaces, boards, itens, memberships).
- JSONB em campos flexíveis (`schema`, `rules`, `fields`, `metadata`, `config`, `permissions`).
- Preparado para busca semântica com `pgvector` em `SearchDocument.embedding`.
- Outbox inicial via tabela `DomainOutbox`.
- Eventos internos já publicados para fluxos principais.
