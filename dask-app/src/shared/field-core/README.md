# Field Core

`shared/field-core` is the frontend-safe base for product fields. It is intentionally free of React and UI dependencies so the same contracts can be mirrored by the backend in a later phase.

Phase 1 keeps WorkItems as the only runtime consumer:

- `FieldType` is the shared superset for current WorkItem fields and future Billing, Fiscal, Marketing, Documentation and Automations fields.
- `FieldDefinition` is the portable metadata contract for form, table, detail, API mapping, permissions and source data.
- `FieldRegistry` centralizes lookup by key/id, filtering by context/entity, legacy aliases, semantic key resolution and duplicate validation.

Future phases should migrate module-local hard coded fields by registering their definitions here first, then replacing local lookup logic with `FieldRegistry` queries.

