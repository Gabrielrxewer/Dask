import { describe, expect, it } from "vitest";
import { buildTaskFieldBindingsForType, type TaskFieldDefinition } from "@/entities/task";
import { applyFieldDrop } from "@/pages/settings-page/model/work-item-layout-editor";

const titleField: TaskFieldDefinition = {
  id: "sys:title",
  definitionId: "field-title",
  label: "Titulo",
  type: "text",
  storage: { kind: "item_property", property: "title" },
  config: { cardArea: "title", detailSection: "main" }
};

const summaryField: TaskFieldDefinition = {
  id: "summary",
  definitionId: "field-summary",
  label: "Resumo",
  type: "text",
  config: { cardArea: "summary", detailSection: "main" }
};

const reviewerField: TaskFieldDefinition = {
  id: "reviewer",
  definitionId: "field-reviewer",
  label: "Revisor",
  type: "user",
  config: { cardArea: "summary", detailSection: "side" }
};

const dueField: TaskFieldDefinition = {
  id: "due",
  definitionId: "field-due",
  label: "Prazo",
  type: "date",
  config: { cardArea: "meta", detailSection: "side" }
};

const allowedFieldIds = new Set([titleField.id, summaryField.id, reviewerField.id, dueField.id]);

const cardAreasByFieldId = {
  "sys:title": "title",
  summary: "summary",
  reviewer: "summary",
  due: "meta"
} as const;

const detailZonesByFieldId = {
  "sys:title": "main",
  summary: "main",
  reviewer: "side",
  due: "side"
} as const;

describe("work-item layout editor drop model", () => {
  it("insere antes do campo alvo ao dropar sobre ele sem remover o campo existente", () => {
    const result = applyFieldDrop({
      draft: {
        card: ["sys:title", "summary", "due"],
        detail: []
      },
      payload: {
        fieldId: "reviewer",
        origin: "library"
      },
      target: {
        surface: "card",
        kind: "replace-field",
        targetFieldId: "summary",
        area: "summary"
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    expect(result.layout.card).toEqual(["sys:title", "reviewer", "summary", "due"]);
    expect(result.layout.card).toContain("summary");
    expect(result.cardAreasByFieldId.reviewer).toBe("summary");
  });

  it("ocupa a vaga vazia correta quando o drop acontece em um placeholder do card", () => {
    const result = applyFieldDrop({
      draft: {
        card: ["sys:title"],
        detail: []
      },
      payload: {
        fieldId: "reviewer",
        origin: "library"
      },
      target: {
        surface: "card",
        kind: "empty-slot",
        area: "summary",
        index: 0
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    expect(result.layout.card).toEqual(["sys:title", "reviewer"]);
    expect(result.cardAreasByFieldId.reviewer).toBe("summary");
  });

  it("atualiza o estado ao mover um campo ja presente na preview sem duplicar ids", () => {
    const result = applyFieldDrop({
      draft: {
        card: ["sys:title", "summary", "due"],
        detail: []
      },
      payload: {
        fieldId: "summary",
        origin: "card"
      },
      target: {
        surface: "card",
        kind: "empty-slot",
        area: "meta",
        index: 1
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    expect(result.layout.card).toEqual(["sys:title", "due", "summary"]);
    expect(result.layout.card.filter((fieldId) => fieldId === "summary")).toHaveLength(1);
    expect(result.cardAreasByFieldId.summary).toBe("meta");
  });

  it("reordena para baixo dentro da mesma area do card sem pular o alvo", () => {
    const result = applyFieldDrop({
      draft: {
        card: ["sys:title", "summary", "reviewer", "due"],
        detail: []
      },
      payload: {
        fieldId: "summary",
        origin: "card"
      },
      target: {
        surface: "card",
        kind: "empty-slot",
        area: "summary",
        index: 2
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    expect(result.layout.card).toEqual(["sys:title", "reviewer", "summary", "due"]);
  });

  it("reordena para baixo dentro da mesma zona do formulario sem pular campos", () => {
    const result = applyFieldDrop({
      draft: {
        card: [],
        detail: ["sys:title", "summary", "reviewer", "due"]
      },
      payload: {
        fieldId: "reviewer",
        origin: "detail"
      },
      target: {
        surface: "detail",
        kind: "insert",
        zone: "side",
        index: 2
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    expect(result.layout.detail).toEqual(["sys:title", "summary", "due", "reviewer"]);
  });

  it("persiste o layout final com a mesma ordem e area mostradas na preview", () => {
    const finalLayout = applyFieldDrop({
      draft: {
        card: ["sys:title", "summary", "due"],
        detail: ["sys:title", "due"]
      },
      payload: {
        fieldId: "summary",
        origin: "card"
      },
      target: {
        surface: "card",
        kind: "replace-field",
        targetFieldId: "due",
        area: "meta"
      },
      allowedFieldIds,
      cardAreasByFieldId: { ...cardAreasByFieldId },
      detailZonesByFieldId: { ...detailZonesByFieldId }
    });

    const persistedBindings = buildTaskFieldBindingsForType({
      typeId: "bug",
      fieldDefinitions: [titleField, summaryField, reviewerField, dueField],
      fieldBindings: [],
      cardFieldIds: finalLayout.layout.card,
      detailFieldIds: finalLayout.layout.detail,
      detailZonesByFieldId: finalLayout.detailZonesByFieldId
    }).map((binding) =>
      binding.displayContext === "card"
        ? {
            ...binding,
            settings: {
              ...(binding.settings ?? {}),
              cardArea: finalLayout.cardAreasByFieldId[binding.fieldId]
            }
          }
        : binding
    );

    const cardBindings = persistedBindings.filter((binding) => binding.displayContext === "card");

    expect(cardBindings.map((binding) => binding.fieldId)).toEqual(finalLayout.layout.card);
    expect(cardBindings.find((binding) => binding.fieldId === "summary")?.settings?.cardArea).toBe("meta");
    expect(cardBindings.find((binding) => binding.fieldId === "due")).toBeDefined();
  });
});
