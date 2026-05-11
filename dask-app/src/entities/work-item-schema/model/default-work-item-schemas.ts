import type { WorkItemPublicSchema } from "@/entities/work-item-schema/model/work-item-schema.types";
import { WORK_ITEM_SCHEMA_VERSION } from "@/entities/work-item-schema/model/work-item-schema-version";

export function createDefaultWorkItemSchema(input: {
  id: string;
  workspaceId: string;
  name?: string;
  workflowStateIds?: string[];
}): WorkItemPublicSchema {
  return {
    schemaVersion: WORK_ITEM_SCHEMA_VERSION,
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name ?? "Work item",
    fields: [],
    layouts: {
      card: { surface: "card", fields: [] },
      detail: { surface: "detail", fields: [] },
      form: { surface: "form", fields: [] }
    },
    workflow: {
      stateIds: input.workflowStateIds ?? []
    }
  };
}

