import type { WorkItemPublicField } from "@/entities/work-item-schema/model/work-item-field.types";
import type { WorkItemPublicLayout } from "@/entities/work-item-schema/model/work-item-layout.types";
import type { WorkItemSchemaVersion } from "@/entities/work-item-schema/model/work-item-schema-version";

export interface WorkItemPublicSchema {
  schemaVersion: WorkItemSchemaVersion;
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  fields: WorkItemPublicField[];
  layouts: {
    card: WorkItemPublicLayout;
    detail: WorkItemPublicLayout;
    form: WorkItemPublicLayout;
  };
  workflow: {
    stateIds: string[];
  };
  permissions?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

