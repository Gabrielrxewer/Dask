# Dask App

Frontend do Dask com React, Vite e TypeScript.

## Stack

- React 18
- Vite
- TypeScript strict
- React Router
- Vitest

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. (Opcional) configure variaveis de ambiente:

```bash
VITE_API_BASE_URL=http://localhost:3333
VITE_API_PREFIX=/api/v1
VITE_AUTH_TRANSPORT_MODE=body-refresh-token
VITE_CSRF_HEADER_NAME=x-csrf-token
```

3. Rode em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run check`
- `npm run smoke:authenticated`
- `npm run smoke:authenticated:release`
- `npm run check:release`

## Auth no frontend

A app possui camada completa de autenticacao com:

- `AuthProvider` + `AuthStore` centralizados
- bootstrap de sessao com `/auth/me`
- refresh automatico com deduplicacao de concorrencia
- tratamento global de `401` com replay controlado (sem loop infinito)
- logout e logout-all integrados
- guard de rota publica/protegida
- limpeza de sessao em expirar/logout
- preparacao para transporte cookie + CSRF

Documentacao detalhada:

- `docs/auth-architecture.md`

## Testes

- Runner: `Vitest`
- Convencao: `*.test.ts` e `*.test.tsx`
- Cobertura inclui fluxo de auth, guards e HTTP client

Smoke autenticado:

- local/dev: `npm run smoke:authenticated`
- release/staging: `npm run smoke:authenticated:release`

O modo local pode pular com mensagem clara quando `DASK_SMOKE_EMAIL`, `DASK_SMOKE_PASSWORD` ou workspace nao estiverem configurados. O modo release define `DASK_RELEASE_SMOKE=1` e falha se faltar `DASK_SMOKE_BASE_URL`, `DASK_SMOKE_API_URL`, credenciais ou `DASK_SMOKE_WORKSPACE_ID`/`DASK_SMOKE_WORKSPACE_SLUG`, ou se qualquer etapa obrigatoria terminar como `skipped`/`environment_gap`. O smoke cobre login, workspace, Dashboard, List, Agenda, Board, Marketing/Journeys, Automation, Documentation, Billing, Fiscal e AI.

Detalhes: `docs/smoke-authenticated.md`

## Estrutura principal

```txt
dask-app/
|-- docs/
|   |-- auth-architecture.md
|-- src/
|   |-- app/
|   |-- entities/
|   |-- features/
|   |-- pages/
|   |-- shared/
|   |-- widgets/
|-- package.json
```

## Documentacao de arquitetura front-end

- Arquitetura atual: `docs/frontend-architecture.md`
- Playbook de evolucao: `docs/frontend-playbook.md`
