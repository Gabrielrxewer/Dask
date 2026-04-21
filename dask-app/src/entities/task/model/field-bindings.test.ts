import { describe, expect, it } from "vitest";
import { factoryBoardConfig } from "@/entities/task/model/board-config";
import {
  buildTaskFieldBindingsForType,
  buildDefaultTaskFieldBindingSettings,
  resolveWorkItemFieldBindings,
  resolveWorkItemFieldBindingsForContext
} from "@/entities/task/model/field-bindings";
import type { BoardConfig, TaskFieldDefinition } from "@/entities/task/model/types";

const titleField: TaskFieldDefinition = {
  id: "sys:title",
  definitionId: "field-title",
  label: "Titulo",
  type: "text",
  required: true,
  storage: { kind: "item_property", property: "title" },
  config: { cardArea: "title", detailSection: "main" }
};

const dueDateField: TaskFieldDefinition = {
  id: "sys:due-date",
  definitionId: "field-due-date",
  label: "Prazo",
  type: "date",
  storage: { kind: "item_property", property: "dueDate" },
  config: { cardArea: "meta", detailSection: "side" }
};

const notesField: TaskFieldDefinition = {
  id: "notes",
  definitionId: "field-notes",
  label: "Notas",
  type: "long_text",
  config: { cardArea: "description", detailSection: "main" }
};

const boardConfigWithBindings: BoardConfig = {
  ...factoryBoardConfig,
  fieldDefinitions: [titleField, dueDateField, notesField],
  fieldBindings: [
    {
      id: "binding-card-notes",
      fieldId: "notes",
      typeId: "bug",
      displayContext: "card",
      order: 0,
      isVisible: true,
      settings: { cardArea: "summary", visualPriority: "secondary" }
    },
    {
      id: "binding-card-title",
      fieldId: "sys:title",
      typeId: "bug",
      displayContext: "card",
      order: 1,
      isVisible: true,
      settings: { cardArea: "title", visualPriority: "primary" }
    },
    {
      id: "binding-detail-notes",
      fieldId: "notes",
      typeId: "bug",
      displayContext: "detail",
      order: 0,
      section: "main",
      isVisible: true,
      settings: { detailZone: "main", visualPriority: "primary" }
    },
    {
      id: "binding-detail-due-date",
      fieldId: "sys:due-date",
      typeId: "bug",
      displayContext: "detail",
      order: 1,
      section: "side",
      isVisible: true,
      settings: { detailZone: "side", visualPriority: "secondary" }
    }
  ],
  cardLayout: {
    visibleFieldIds: ["sys:title"],
    visibleFieldIdsByType: {
      bug: ["sys:title", "sys:due-date"]
    },
    detailVisibleFieldIdsByType: {
      bug: ["sys:title"]
    },
    detailFieldZoneByType: {
      bug: {
        "sys:title": "main"
      }
    }
  }
};

describe("field-bindings", () => {
  it("prioriza bindings sobre cardLayout no runtime", () => {
    const cardBindings = resolveWorkItemFieldBindings(boardConfigWithBindings, "bug", "card");

    expect(cardBindings.map((binding) => binding.field.id)).toEqual(["notes", "sys:title"]);
    expect(cardBindings.map((binding) => binding.cardArea)).toEqual(["summary", "title"]);
    expect(cardBindings[0]?.source).toBe("binding");
  });

  it("reusa a mesma definicao de detail para form", () => {
    const formBindings = resolveWorkItemFieldBindingsForContext(boardConfigWithBindings, "bug", "form");

    expect(formBindings.map((binding) => binding.field.id)).toEqual(["notes", "sys:due-date"]);
    expect(formBindings.map((binding) => binding.zone)).toEqual(["main", "side"]);
    expect(formBindings.every((binding) => binding.runtimeContext === "form")).toBe(true);
  });

  it("faz fallback para layout legado quando bindings nao existem", () => {
    const legacyBindings = resolveWorkItemFieldBindings(
      {
        ...boardConfigWithBindings,
        fieldBindings: []
      },
      "bug",
      "card"
    );

    expect(legacyBindings.map((binding) => binding.field.id)).toEqual(["sys:title", "sys:due-date"]);
    expect(legacyBindings.every((binding) => binding.source === "legacy")).toBe(true);
  });

  it("deriva settings default por contexto sem segunda autoria", () => {
    expect(buildDefaultTaskFieldBindingSettings(titleField, "card")).toEqual({
      cardArea: "title",
      visualPriority: "primary",
      surfaces: { card: true, inline: true }
    });
    expect(buildDefaultTaskFieldBindingSettings(notesField, "detail")).toEqual({
      detailZone: "main",
      visualPriority: "primary",
      surfaces: { detail: true, form: true }
    });
  });

  it("materializa bindings do editor preservando settings reais e overrides", () => {
    const bindings = buildTaskFieldBindingsForType({
      typeId: "bug",
      fieldDefinitions: [titleField, dueDateField, notesField],
      fieldBindings: [
        {
          id: "existing-card-notes",
          fieldId: "notes",
          typeId: "bug",
          displayContext: "card",
          order: 4,
          isVisible: true,
          isReadonlyOverride: true,
          settings: {
            cardArea: "summary",
            visualPriority: "secondary",
            surfaces: { card: true, inline: false }
          }
        },
        {
          id: "existing-detail-due-date",
          fieldId: "sys:due-date",
          typeId: "bug",
          displayContext: "detail",
          order: 8,
          section: "main",
          isVisible: true,
          settings: {
            detailZone: "main",
            visualPriority: "primary",
            surfaces: { detail: true, form: false }
          }
        }
      ],
      cardFieldIds: ["notes", "sys:title"],
      detailFieldIds: ["sys:due-date"],
      detailZonesByFieldId: {
        "sys:due-date": "side"
      }
    });

    expect(bindings).toEqual([
      {
        id: "existing-card-notes",
        fieldId: "notes",
        typeId: "bug",
        fieldDefinitionId: undefined,
        workItemTypeId: undefined,
        displayContext: "card",
        order: 0,
        section: null,
        isVisible: true,
        isRequiredOverride: null,
        isReadonlyOverride: true,
        settings: {
          cardArea: "summary",
          visualPriority: "secondary",
          surfaces: { card: true, inline: false }
        }
      },
      {
        id: "draft-card-bug-sys:title",
        fieldId: "sys:title",
        typeId: "bug",
        fieldDefinitionId: undefined,
        workItemTypeId: undefined,
        displayContext: "card",
        order: 1,
        section: null,
        isVisible: true,
        isRequiredOverride: null,
        isReadonlyOverride: null,
        settings: {
          cardArea: "title",
          visualPriority: "primary",
          surfaces: { card: true, inline: true }
        }
      },
      {
        id: "existing-detail-due-date",
        fieldId: "sys:due-date",
        typeId: "bug",
        fieldDefinitionId: undefined,
        workItemTypeId: undefined,
        displayContext: "detail",
        order: 0,
        section: "side",
        isVisible: true,
        isRequiredOverride: null,
        isReadonlyOverride: null,
        settings: {
          detailZone: "side",
          visualPriority: "primary",
          surfaces: { detail: true, form: false }
        }
      }
    ]);
  });
});
