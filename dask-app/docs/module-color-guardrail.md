# Module Color Guardrail

`npm run check:module-colors` scans visual module files under `src/modules/**/*.css` and `src/modules/**/*.tsx`.

It blocks new hardcoded color literals:

- hex colors, such as `#2563eb`;
- direct `rgb(...)` or `rgba(...)`;
- direct `hsl(...)` or `hsla(...)`.

Module UI should use workspace tokens instead, for example:

```css
color: var(--workspace-text-primary);
border-color: var(--workspace-border);
background: var(--workspace-surface);
```

## Whitelist

Use an inline whitelist only when the color is intentionally outside the workspace token system, such as chart palettes, status colors owned by runtime data, or base token definitions moved into a module.

Put the reason on the same line or the previous line:

```css
/* color-guardrail-allow: chart palette uses product analytics colors */
--chart-series-a: #2563eb;
```

```tsx
const statusColor = "#16a34a"; // color-guardrail-allow: status color comes from exported status palette
```

Do not whitelist routine layout, surface, border, text, hover, or selected states. Prefer the `--workspace-*` tokens for those cases.
