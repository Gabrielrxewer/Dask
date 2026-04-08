# Testing Standard

## Objective

Keep unit tests fast, deterministic, and easy to evolve for both app and api.

## Tooling

- Runner: `Vitest`
- Frontend file pattern: `*.test.ts`
- Backend file pattern: `*.spec.ts`

## Rules

- One behavior per test case.
- Prefer pure function and service tests for unit scope.
- Avoid network and database in unit tests.
- Use clear arrange/act/assert structure.

## Commands

From repository root:

- `npm run test:app`
- `npm run test:api`
- `npm run check:all`
