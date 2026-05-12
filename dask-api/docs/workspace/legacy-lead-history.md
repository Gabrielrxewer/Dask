# Legacy Lead History

`Lead` is a historical database table retained so old migrations and archived data keep referential integrity. The Prisma models for `Lead*` are marked `@@ignore`, so they are not part of the generated Prisma Client.

Active commercial flows use:

- `Item` / WorkItem for signals, prospects, leads, opportunities, proposals, contracts, billing status, and follow-ups.
- `Customer` for the customer registry and customer access links.
- `MarketingEvent.itemId` for marketing signals tied to the commercial WorkItem.

Rules for new code:

- Do not mount routes backed by `Lead`.
- Do not query `prisma.lead` from Marketing, UI-facing services, or integrations. The generated client should not expose `lead*` delegates.
- Do not create fallbacks that read `Lead` when a WorkItem is missing.
- Treat `legacyLeadId` columns in Marketing tables as historical compatibility fields only. New active events should use `itemId`/`workItemId`; do not write `metadata.leadId`.
