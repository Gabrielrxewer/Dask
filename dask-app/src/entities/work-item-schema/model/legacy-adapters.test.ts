import { describe, expect, it } from "vitest";
import type { BoardConfig } from "@/entities/task";
import { legacyFieldBindingsToPublicSchema } from "@/entities/work-item-schema/model/legacy-adapters";

describe("legacyFieldBindingsToPublicSchema", () => {
  it("preserva campos legados e normaliza tipos compativeis com WorkItems", () => {
    const boardConfig: BoardConfig = {
      statuses: [{ id: "todo", label: "Todo", dot: "gray" }],
      taskTypes: [],
      cardLayout: { visibleFieldIds: [] },
      perspectives: [],
      fieldDefinitions: [
        {
          id: "runtime-contact",
          definitionId: "field-contact",
          label: "Contato",
          variableKey: "contactName",
          description: "Nome do contato",
          type: "long_text",
          required: true,
          defaultValue: "",
          options: [],
          config: { custom: true },
          storage: { kind: "custom_field", property: "contactName" }
        },
        {
          id: "runtime-active",
          definitionId: "field-active",
          label: "Ativo",
          variableKey: "active",
          type: "boolean",
          required: false
        }
      ],
      fieldBindings: [
        {
          id: "binding-contact",
          fieldId: "field-contact",
          typeId: "schema",
          displayContext: "detail",
          order: 0,
          isVisible: true
        },
        {
          id: "binding-active",
          fieldId: "field-active",
          typeId: "schema",
          displayContext: "card",
          order: 1,
          isVisible: true
        }
      ]
    };

    const schema = legacyFieldBindingsToPublicSchema({
      schemaId: "schema",
      workspaceId: "workspace",
      name: "Schema",
      boardConfig
    });

    expect(schema.fields).toMatchObject([
      {
        id: "field-contact",
        key: "contactName",
        label: "Contato",
        description: "Nome do contato",
        type: "textarea",
        required: true,
        metadata: {
          custom: true,
          runtimeFieldId: "runtime-contact",
          storage: { kind: "custom_field", property: "contactName" }
        }
      },
      {
        id: "field-active",
        key: "active",
        label: "Ativo",
        type: "checkbox",
        required: false,
        metadata: {
          runtimeFieldId: "runtime-active"
        }
      }
    ]);
  });
});
