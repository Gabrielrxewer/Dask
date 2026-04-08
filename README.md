# Dask Monorepo

Este repositorio esta organizado em dois projetos:

- `dask-app`: frontend React + Vite + TypeScript
- `dask-api`: backend Node.js + Express + TypeScript

## Estrutura

```txt
.
|-- dask-app/
|-- dask-api/
|-- package.json
```

## Requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose (para PostgreSQL/Redis da API)

## Setup rapido

1. Subir infraestrutura Docker:

```bash
npm run infra:up
```

2. Instalar dependencias da API:

```bash
npm --prefix dask-api install
```

3. Instalar dependencias do app:

```bash
npm --prefix dask-app install
```

## Comandos da raiz

- `npm run infra:up`
- `npm run infra:down`
- `npm run infra:logs`
- `npm run infra:reset`
- `npm run dev:app`
- `npm run dev:api`
- `npm run build:app`
- `npm run build:api`
- `npm run test:app`
- `npm run test:api`
- `npm run check:all`

## Padrao de qualidade

Cada projeto possui scripts padronizados:

- `typecheck`
- `test`
- `test:watch`
- `test:coverage`
- `check`

Objetivo do `check`: garantir verificacao minima local antes de merge.
