# Dask App

Frontend do Dask com React, Vite e TypeScript.

## Stack

- React 18
- Vite
- TypeScript strict
- React Router
- Vitest (testes unitarios)

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. Rode em desenvolvimento:

```bash
npm run dev
```

## Scripts padrao

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run check`

## Testes unitarios

- Runner: `Vitest`
- Convencao: `*.test.ts`
- Exemplo: `src/features/dashboard-filter/model/filter-utils.test.ts`

## Estrutura principal

```txt
dask-app/
|-- src/
|   |-- app/
|   |-- entities/
|   |-- features/
|   |-- pages/
|   |-- widgets/
|-- package.json
```
