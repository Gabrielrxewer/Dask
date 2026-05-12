import { describe, expect, it } from "vitest";
import { normalizeWorkItemListParams, workItemListQueryKeys } from "@/modules/work-item-list/query/work-item-list-query-keys";

describe("workItemListQueryKeys", () => {
  it("remove valores vazios e normaliza busca para a key", () => {
    expect(normalizeWorkItemListParams({
      page: 1,
      pageSize: 50,
      search: "  contrato  ",
      assigneeId: "",
      assignedToMe: false,
      sortBy: "dueDate",
      sortDirection: "asc"
    })).toEqual({
      page: 1,
      pageSize: 50,
      search: "contrato",
      assignedToMe: false,
      sortBy: "dueDate",
      sortDirection: "asc",
      workflowStateIds: [],
      customFieldFilters: []
    });
  });

  it("inclui filtros compostos na key da lista", () => {
    const key = workItemListQueryKeys.list("workspace-a", {
      page: 2,
      pageSize: 25,
      workflowStateIds: ["todo", "done"],
      customFieldFilters: [{ fieldKey: "customerId", value: "customer-1" }]
    });

    expect(key).toEqual([
      "work-item-list",
      "workspace-a",
      "list",
      {
        page: 2,
        pageSize: 25,
        workflowStateIds: ["todo", "done"],
        customFieldFilters: [{ fieldKey: "customerId", value: "customer-1" }]
      }
    ]);
  });

  it("mantem paginas amplas de List isoladas por janela planejada e cursor", () => {
    const base = {
      page: 3,
      pageSize: 200,
      plannedStartFrom: "2026-05-04T00:00:00.000Z",
      plannedStartTo: "2026-05-11T00:00:00.000Z",
      sortBy: "plannedStartAt" as const,
      sortDirection: "asc" as const
    };

    expect(normalizeWorkItemListParams(base)).toEqual({
      ...base,
      workflowStateIds: [],
      customFieldFilters: []
    });
    expect(workItemListQueryKeys.list("workspace-a", base))
      .not.toEqual(workItemListQueryKeys.list("workspace-a", {
        ...base,
        plannedStartFrom: "2026-05-11T00:00:00.000Z",
        plannedStartTo: "2026-05-18T00:00:00.000Z"
      }));
  });
});
