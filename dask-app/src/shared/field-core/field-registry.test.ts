import { describe, expect, it } from "vitest";
import { createFieldRegistry, type FieldDefinition } from "@/shared/field-core";

const baseField = {
  id: "field:id",
  key: "fieldKey",
  label: "Field",
  type: "text"
} satisfies FieldDefinition;

describe("FieldRegistry", () => {
  it("detecta duplicidade de key e id", () => {
    const registry = createFieldRegistry();

    expect(() => registry.registerFields([
      baseField,
      { ...baseField, id: "field:other-id" }
    ])).toThrow("Duplicate field key registered: fieldKey");

    expect(() => registry.registerFields([
      baseField,
      { ...baseField, key: "otherKey" }
    ])).toThrow("Duplicate field id registered: field:id");
  });

  it("resolve aliases legados e semantic keys", () => {
    const registry = createFieldRegistry([
      { ...baseField, key: "contact.email" }
    ]);

    expect(registry.resolveAlias("contactEmail")).toBe("contact.email");
    expect(registry.resolveSemanticKey("contactEmail")).toBe("contact.email");
    expect(registry.getFieldByKey("contactEmail")?.id).toBe("field:id");
  });

  it("busca campos por id, contexto e entidade", () => {
    const registry = createFieldRegistry([
      { ...baseField, context: ["work_item.form"], entity: "work_item" },
      {
        id: "customer:id",
        key: "customerId",
        label: "Customer",
        type: "relation",
        context: "work_item.detail",
        entity: "customer"
      }
    ]);

    expect(registry.getFieldById("field:id")?.key).toBe("fieldKey");
    expect(registry.getFieldsByContext("work_item.form").map(field => field.key)).toEqual(["fieldKey"]);
    expect(registry.getFieldsByEntity("customer").map(field => field.key)).toEqual(["customerId"]);
  });
});

