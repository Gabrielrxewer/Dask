import { describe, expect, it } from "vitest";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import type { BoardConfig, TaskFieldBinding, TaskFieldDefinition } from "@/entities/task";
import {
  buildDefaultWorkItemListConfig,
  readWorkItemListConfigs,
  upsertWorkItemListConfigInSettings
} from "@/modules/work-item-list/model/work-item-list-config";
import { WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION } from "@/modules/work-item-list/model/types";

const titleField: TaskFieldDefinition = {
  id: "sys:title",
  definitionId: "field-title",
  label: "Titulo",
  type: "text",
  required: true,
  storage: { kind: "item_property", property: "title" }
};

const effortField: TaskFieldDefinition = {
  id: "effort",
  definitionId: "field-effort",
  label: "Esforco",
  type: "number",
  required: false
};

const customerField: TaskFieldDefinition = {
  id: "customer",
  definitionId: "field-customer",
  label: "Cliente",
  slug: "customerId",
  type: "text",
  config: { entityType: "customer" }
};

const boardConfig: BoardConfig = {
  ...factoryBoardConfig,
  fieldDefinitions: [titleField, effortField, customerField],
  fieldBindings: [
    {
      id: "detail-title",
      fieldId: "sys:title",
      typeId: "bug",
      displayContext: "detail",
      order: 0,
      isVisible: true
    },
    {
      id: "detail-effort",
      fieldId: "effort",
      typeId: "bug",
      displayContext: "detail",
      order: 1,
      isVisible: true
    },
    {
      id: "detail-customer",
      fieldId: "customer",
      typeId: "bug",
      displayContext: "detail",
      order: 2,
      isVisible: true
    }
  ]
};

describe("work-item-list-config", () => {
  it("gera colunas fixas e dinamicas a partir do schema do tipo", () => {
    const config = buildDefaultWorkItemListConfig({
      workspaceId: "workspace-1",
      workItemTypeId: "bug",
      boardConfig
    });

    expect(config.schemaVersion).toBe(WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION);
    expect(config.columns.map((column) => column.id)).toEqual(
      expect.arrayContaining(["title", "type", "status", "assignee", "dueDate", "progress", "actions", "field:effort", "field:customer"])
    );
    expect(config.columns.find((column) => column.id === "sys:title")).toBeUndefined();
    expect(config.columns.find((column) => column.id === "field:effort")).toMatchObject({
      fieldId: "effort",
      label: "Esforco",
      sortable: true,
      filterable: true
    });
    expect(config.columns.find((column) => column.id === "field:customer")?.type).toBe("customer");
  });

  it("usa a mesma configuracao para compor o layout mobile", () => {
    const config = buildDefaultWorkItemListConfig({
      workspaceId: "workspace-1",
      workItemTypeId: "bug",
      boardConfig
    });

    expect(config.mobileCardLayout.titleField).toBe("title");
    expect(config.mobileCardLayout.badgeFields).toEqual(["type", "status"]);
    expect(config.mobileCardLayout.primaryMetaFields).toEqual(["assignee", "dueDate"]);
    expect(config.mobileCardLayout.secondaryMetaFields).toContain("progress");
  });

  it("persiste e mescla preferencias sem perder novas colunas do fallback", () => {
    const fallback = buildDefaultWorkItemListConfig({
      workspaceId: "workspace-1",
      workItemTypeId: "bug",
      boardConfig
    });
    const persisted = {
      ...fallback,
      density: "comfortable" as const,
      columns: fallback.columns.map((column) =>
        column.id === "status" ? { ...column, visible: false } : column
      )
    };
    const settings = upsertWorkItemListConfigInSettings({}, persisted);
    const nextBoardConfig = {
      ...boardConfig,
      fieldDefinitions: [
        ...boardConfig.fieldDefinitions,
        { id: "impact", definitionId: "field-impact", label: "Impacto", type: "select" } satisfies TaskFieldDefinition
      ],
      fieldBindings: [
        ...(boardConfig.fieldBindings ?? []),
        {
          id: "detail-impact",
          fieldId: "impact",
          typeId: "bug",
          displayContext: "detail",
          order: 3,
          isVisible: true
        } satisfies TaskFieldBinding
      ]
    };

    const config = buildDefaultWorkItemListConfig({
      workspaceId: "workspace-1",
      workItemTypeId: "bug",
      boardConfig: nextBoardConfig,
      settings
    });

    expect(readWorkItemListConfigs(settings).bug?.density).toBe("comfortable");
    expect(config.density).toBe("comfortable");
    expect(config.columns.find((column) => column.id === "status")?.visible).toBe(false);
    expect(config.columns.find((column) => column.id === "field:impact")).toBeDefined();
  });
});
