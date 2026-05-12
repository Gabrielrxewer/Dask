# Internal Redaction Standard

All backend modules should use `src/core/security/redaction.ts` before writing logs, metadata intended for diagnostics, telemetry reasons, or client-facing error details.

Central helpers:

- `redactSensitiveText(value)`: removes tokens, API keys, bearer/basic auth, Stripe secrets, webhook secrets, card-like numbers, emails and phones from AI prompts or provider error text.
- `redactSensitiveValue(value)`: recursively redacts sensitive keys such as `authorization`, `token`, `apiKey`, `secret`, `signature`, `focusToken`, `webhookSecret`, and `stripeSecretKey`.
- `redactLogData(value)`: log-safe wrapper that also masks emails and phones while preserving diagnostic fields such as ids, status, provider, request id and business reason.
- `redactErrorMessage(error)` / `redactError(error)`: safe error text and details for logs, telemetry and client responses.
- `maskEmail` / `maskPhone`: shared personal-data masks for public/observability views.

Do not log raw request bodies, webhook signatures, authorization headers, provider responses, AI prompts, or client metadata directly. If a module needs to retain diagnostic context, keep non-sensitive identifiers and counts, and pass the rest through the central redaction helper.
