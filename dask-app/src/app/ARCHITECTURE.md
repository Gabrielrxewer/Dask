# Front-end Architecture

## Goals
- Keep the app scalable by separating routing, domain state, features, entities, widgets and shared primitives.
- Allow new modules to grow without turning `shared` or `pages` into catch-all folders.
- Keep business rules outside page components whenever possible.

## Layers
- `app/`: application shell, providers, layout, router, global styles and app-level composition.
- `pages/`: route entry points. Pages should orchestrate widgets/features and stay thin.
- `widgets/`: large UI compositions for a screen or workflow section.
- `features/`: user actions or business use cases such as auth, filtering or task creation.
- `entities/`: domain objects and their local presentation/model helpers.
- `modules/`: bounded contexts with app-wide state/data orchestration, such as `workspace`.
- `shared/`: reusable technical or visual primitives only when they are truly generic.

## Conventions
- Routes live in `app/router/` and use `route-paths.ts` for navigation contracts.
- Each domain folder should expose a narrow public API through `index.ts`.
- Prefer importing across layers through public APIs such as `@/features/auth`, `@/modules/workspace`, `@/pages`, `@/app/layout` and `@/app/router`.
- Prefer colocating `ui`, `model`, `api`, `providers` and tests inside the owning feature/module/entity.
- Pages import from barrels (`@/pages`, `@/modules/workspace`) instead of deep paths when using public APIs.
- If a component is only used by one feature or widget, keep it local instead of moving it to `shared`.

## Growth Rules
- Add new routeable screens in `pages/<name>-page/`, then register them in `app/router/app-routes.tsx`.
- Add new use cases in `features/` when they represent user intent and can be reused across pages.
- Add new cross-screen domain orchestration in `modules/` only when state/data flows exceed a single feature.
- `shared/ui` should contain primitives, not product-specific compositions.
- Product-specific styling should stay near the owning page/feature/widget; tokens and shared primitives belong in `app/styles` or `shared/ui/styles`.
