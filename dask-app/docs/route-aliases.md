# Route aliases

## `/w/:workspaceSlug/leads`

Decision: `/leads` is not an active technical domain in the frontend. It is a product/URL alias for users or saved links that still point to the old product term.

Runtime behavior: the router redirects `/w/:workspaceSlug/leads` to `/w/:workspaceSlug/commercial` with `replace`, so browser history and bookmarks converge on the official route.

Internal ownership: code must use `modules/commercial`, `pages/commercial-page`, WorkItem, Customer, and Signal types. Do not add `modules/leads`, Lead DTOs, Lead services, or Lead endpoint calls behind this alias. Technical names for this route should use `commercialLeadsAlias` rather than `legacyLead*`.

UX language: labels may use business-friendly commercial wording, but the technical route/module/service names remain Commercial/WorkItem/Customer/Signal.
