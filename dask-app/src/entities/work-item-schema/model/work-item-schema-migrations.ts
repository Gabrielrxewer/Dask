import type { WorkItemPublicSchema } from "@/entities/work-item-schema/model/work-item-schema.types";
import { WORK_ITEM_SCHEMA_VERSION } from "@/entities/work-item-schema/model/work-item-schema-version";
import { workItemPublicSchemaZod } from "@/entities/work-item-schema/model/work-item-schema.zod";

export function migrateWorkItemSchema(value: unknown): WorkItemPublicSchema {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const schemaVersion = record.schemaVersion === WORK_ITEM_SCHEMA_VERSION ? WORK_ITEM_SCHEMA_VERSION : WORK_ITEM_SCHEMA_VERSION;
  const candidate = {
    ...record,
    schemaVersion
  };

  return workItemPublicSchemaZod.parse(candidate);
}

