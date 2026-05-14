import { describe, expect, expectTypeOf, it } from "vitest";
import type { FieldDefinition } from "@/shared/field-core";
import type { WorkItemPublicField, WorkItemPublicSchema } from "@/entities/work-item-schema";
import { WORK_ITEM_SCHEMA_VERSION } from "@/entities/work-item-schema";
import { buildWorkItemDefaultValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";
import { mapFormValuesToWorkItemPayload } from "@/entities/work-item-form/mapFormValuesToWorkItemPayload";

const fields: WorkItemPublicField[] = [
  { id: "title", key: "title", label: "Titulo", type: "text", required: true },
  { id: "items", key: "items", label: "Itens", type: "multi_select", required: false },
  { id: "approved", key: "approved", label: "Aprovado", type: "boolean", required: false },
  { id: "total", key: "total", label: "Total", type: "billing_summary", required: false },
  { id: "computed", key: "computed", label: "Calculado", type: "computed", required: false },
  { id: "defaulted", key: "defaulted", label: "Padrao", type: "number", required: false, defaultValue: 10 }
];

const schema: WorkItemPublicSchema = {
  schemaVersion: WORK_ITEM_SCHEMA_VERSION,
  id: "schema",
  workspaceId: "workspace",
  name: "Schema",
  fields,
  layouts: {
    card: { surface: "card", fields: [] },
    detail: { surface: "detail", fields: [] },
    form: { surface: "form", fields: [] }
  },
  workflow: { stateIds: [] }
};

describe("WorkItems com Field Core", () => {
  it("mantem WorkItemPublicField compativel com FieldDefinition", () => {
    expectTypeOf<WorkItemPublicField>().toExtend<FieldDefinition>();
  });

  it("mantem os default values existentes", () => {
    expect(buildWorkItemDefaultValues(schema)).toEqual({
      title: "",
      items: [],
      approved: false,
      total: null,
      computed: null,
      defaulted: 10
    });
  });

  it("mantem o payload final sem campos computados", () => {
    expect(mapFormValuesToWorkItemPayload({
      title: "Nova tarefa",
      items: ["a", "b"],
      approved: true,
      total: 120,
      computed: "ignorado",
      defaulted: 10
    }, schema)).toEqual({
      fields: {
        title: "Nova tarefa",
        items: ["a", "b"],
        approved: true,
        defaulted: 10
      }
    });
  });
});

