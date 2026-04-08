# Frontend Style Architecture

## Goals
- Keep design tokens centralized in `tokens.css`.
- Keep styles modular by feature/component domain.
- Avoid monolithic CSS files as the system grows.
- Keep visual primitives aligned with the architecture layers documented in `src/app/ARCHITECTURE.md`.

## Conventions
- Global primitives: `src/app/styles/global.css` + `tokens.css`.
- Component/feature styles: colocated with component (`*.css`).
- Shared UI styles: split by domain in `src/shared/ui/styles/` and composed via `shared-ui.css`.
- Prefer CSS variables over hardcoded values when possible.

## Token Groups
- Colors and surfaces: use semantic tokens such as `--panel`, `--surface-raised`, `--surface-muted`, `--accent`, `--danger`.
- Typography: use `--font-size-*` tokens plus `--font-size-label` and `--font-size-title-*` for hierarchy.
- Spacing and radius: use `--space-*`, `--radius-*`, `--radius-pill`.
- Elevation and interaction: use `--shadow-*`, `--focus`, `--focus-strong`, `--state-*`.
- Controls: use `--control-*` tokens for shared heights, padding, borders and input/button/select/textarea surfaces.

## Shared UI Modules
- `forms.css`: select/textarea/form field primitives.
- `modal.css`: shared modal shell/overlay.
- `section.css`: section containers and empty states.
- `feedback.css`: badges/loading visual states.
- `cards.css`: generic cards and metric cards.
- `tabs.css`: shared tabs primitives.
- `page-header.css`: page header and filter bar.
- `data-table.css`: shared table layout primitives.

## Scaling Notes
- New shared styles should be added in a dedicated module file and imported by `shared-ui.css`.
- Avoid adding large unrelated blocks to existing files.
- For variants, prefer `component--variant` classes and token-driven values.
- If a local component overrides a shared primitive, keep the override narrow and preserve token usage so the visual language stays consistent.
