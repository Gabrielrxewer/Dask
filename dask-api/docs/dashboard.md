# Dynamic Dashboard Module

## Endpoints

All endpoints are workspace-scoped and require authenticated workspace access.

- `GET /workspaces/:workspaceId/dashboard/overview`
- `GET /workspaces/:workspaceId/dashboard/crm`
- `GET /workspaces/:workspaceId/dashboard/automation`
- `GET /workspaces/:workspaceId/dashboard/widgets`

Supported query filters:

- `from`, `to` as ISO dates
- `assigneeId`
- `itemTypeId`
- `stateId`
- `columnId`
- `workflowId`
- `status`

Every query includes `workspaceId`. The route layer enforces `dashboard.view`; CRM widgets also require `item.read`, and automation widgets require `automation.runs.read` plus the `automation` module.

## Widgets

Current MVP widgets:

- `crm.activeWorkItems`
- `crm.cardsByColumn`
- `crm.commercialFunnel`
- `crm.cardsByState`
- `crm.cardsByAssignee`
- `crm.overdueWorkItems`
- `crm.unassignedWorkItems`
- `crm.createdWorkItemsInPeriod`
- `crm.completedWorkItemsInPeriod` as unavailable
- `crm.averageAgingByStage` as unavailable
- `automation.runsByStatus`
- `automation.failuresByWorkflow`
- `automation.pendingHumanApprovals`

Unavailable widgets are returned with `status: "unavailable"` and `unavailableReason`.

## Adding A Widget

1. Add a metric query to `dashboard-metrics-service.ts`.
2. Keep the Prisma query scoped by `workspaceId` and reuse `DashboardMetricContext` filters.
3. Add the widget contract in `dashboard-widgets-service.ts`.
4. Add a frontend renderer only if the widget uses a new `type`.
5. Add focused tests for filters, workspace isolation, and empty data.

## Known Limitations

- Completed cards by period are not calculated yet because `Item` has no `completedAt`, and domain outbox events are not an indexed reporting read model by workspace.
- Aging by stage is not calculated yet because the schema does not persist a reliable column/state entry timestamp.
- Cache is not implemented in this increment. The services are separated so a cache can wrap `DashboardQueryService` later.
- Advanced marketing, communication, billing and AI reporting should be added as separate widget families once their read models and permissions are stabilized.

## Recommended Next PR

- Add a workspace-scoped reporting table for work item transitions.
- Backfill terminal transition/completion timestamps from trusted events where possible.
- Add optional cache with invalidation from domain events.
- Add marketing, billing, communication and AI widgets behind their existing module permissions.
